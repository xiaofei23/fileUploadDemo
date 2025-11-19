<template>
  <div id="app">
    <h1>大文件上传</h1>
    <input type="file" @change="handleFileChange" />
    <select name="" id="" v-model="selectedMb">
      <option value="5">5MB</option>
      <option value="10">10MB</option>
      <option value="20">20MB</option>
    </select>
  </div>
</template>
<script setup>
import { getCurrentInstance, ref } from 'vue'
import axios from 'axios'
const axiosInstance = axios.create({
  baseURL: '/api', // 接口基础路径
  timeout: 50000, // 5秒超时（内置支持，无需手动处理）
})
//文件名
const fileName = ref('')
const fileHash = ref('')
//获取当前组件实例
const { appContext } = getCurrentInstance()
//使用SparkMD5
const SparkMD5 = appContext.config.globalProperties.$SparkMD5
//下拉框
const selectedMb = ref('5')
//分片大小
const CHUNK_SIZE = ref(5 * 1024 * 1024)
//分片方法
const createChunks = (file, size = CHUNK_SIZE.value) => {
  const chunks = []
  let cur = 0
  while (cur < file.size) {
    chunks.push({ file: file.slice(cur, cur + size) })
    cur += size
  }
  console.log('文件分片结果：', chunks)
  return chunks
}
//计算hash
const caculateHash = (chunks) => {
  return new Promise((reslove) => {
    //调用SparkMD5
    const sparkMd5 = new SparkMD5.ArrayBuffer()
    //存储计算的切片
    const targets = []
    //异步读取文件
    const fileReader = new FileReader()
    chunks.forEach((chunk, index) => {
      const blob = chunk.file
      if (index === 0 || index === chunks.length - 1) {
        targets.push(blob)
      } else {
        targets.push(blob.slice(0, 2))
        targets.push(blob.slice(CHUNK_SIZE.value / 2, CHUNK_SIZE.value / 2 + 2))
        targets.push(blob.slice(CHUNK_SIZE.value - 2, CHUNK_SIZE.value))
      }
    })
    fileReader.readAsArrayBuffer(new Blob(targets))
    console.log('targets', targets)
    fileReader.onload = (e) => {
      sparkMd5.append(e.target.result)
      const hash = sparkMd5.end()
      reslove(hash)
    }
  })
}
//上传分片
const uploadChunks = async (chunks) => {
  const totalChunks = chunks.length // 总分片数
  const originalFileName = fileName.value // 原文件名
  const data = chunks.map((chunk, index) => {
    return {
      fileHash: fileHash.value,
      chunkHash: fileHash.value + '-' + index,
      chunk: chunk.file,
    }
  })
  const formDatas = data.map((item) => {
    const formData = new FormData()

    formData.append('fileHash', item.fileHash)
    formData.append('chunkHash', item.chunkHash)
    formData.append('chunk', item.chunk)
    formData.append('originalFileName', originalFileName) // 后端接收参数
    formData.append('totalChunks', totalChunks) // 后端接收参数
    return formData
  })
  const max = 6
  let index = 0
  const taskPool = []

  while (index < formDatas.length) {
    const task = axiosInstance.post('/chunkUpload/upload', formDatas[index]).catch((err) => {
      console.error('分片上传失败：', err)
      return null // 避免 Promise.reject 导致并发中断
    })
    task
      .then(() => {
        taskPool.splice(
          taskPool.findIndex((item) => item === task),
          1
        )
      })
      .catch(() => {
        taskPool.splice(
          taskPool.findIndex((item) => item === task),
          1
        )
      })
    taskPool.push(task) // 将当前请求加入请求池
    if (taskPool.length === max) {
      // 当请求池达到最大并发数时
      await Promise.race(taskPool) // 等待“请求池中任意一个请求完成”
    }
    index++ // 处理下一个分片
  }
  await Promise.all(taskPool) // 等待剩余的请求完成
  console.log('所有分片上传完成')
}

//主程序
const handleFileChange = async (event) => {
  const myFile = event.target.files[0]
  if (!myFile) return
  fileName.value = myFile.name
  console.log('选择的文件：', myFile)
  //选择不同
  const mb = Number(selectedMb.value) // 转为数字（5、10、20）
  CHUNK_SIZE.value = mb * 1024 * 1024 // 转为字节数（如 5MB → 5242880 字节）
  console.log('当前选中的分片大小：', mb + 'MB')
  //文件分片
  const chunks = createChunks(myFile)
  const hash = await caculateHash(chunks)
  console.log('文件hash值：', hash)
  fileHash.value = hash
  uploadChunks(chunks)
  try {
    const checkRes = await axiosInstance.get('/chunkUpload/check', {
      params: {
        fileHash: hash,
        totalChunks: chunks.length,
        originalFileName: myFile.name,
      },
    })
    if (checkRes.data.success) {
      if (checkRes.data.allUploaded) {
        console.log('文件已完整上传到 TOS：', checkRes.data.filePath)
        alert('文件已上传完成！')
        return
      } else {
        console.log('已上传的分片：', checkRes.data.uploadedChunkHashes)
        // 过滤掉已上传的分片，只上传未完成的
        const unUploadedChunks = chunks.filter((_, index) => {
          const chunkHash = hash + '-' + index
          return !checkRes.data.uploadedChunkHashes.includes(chunkHash)
        })
        if (unUploadedChunks.length === 0) {
          alert('文件已上传完成！')
          return
        }
        await uploadChunks(unUploadedChunks) // 上传未完成的分片
      }
    }
  } catch (err) {
    console.error('断点续传校验失败，将重新上传所有分片：', err)
    await uploadChunks(chunks) // 校验失败，上传所有分片
  }
}
</script>
<style scoped></style>
