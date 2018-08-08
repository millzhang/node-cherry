const STATUS = {
  READ_SUCCESS: 1,
  READ_FAIL: 2,
  UPLOAD_SUCCESS: 101,
  UPLOAD_FAIL: 102
}
const STATE = {
  DELETE: -1,
  PAUSE: 0,
  WORKING: 1,
  COMPLETE: 2
}

class FileUploader {
  constructor(file, options) {
    console.log('init Uploader')
    this.file = file
    this.state = STATE.WORKING
    this.opt = Object.assign(
      {
        chunkSize: Math.pow(1024, 2) * 5,
        unique: true, //是否对文件使用sparkmd5,不适用的无读取过程，速度快，但无法保证文件唯一性
        url: '/upload',
        progress: function() {},
        complete: function() {},
        cancel: function() {},
        clearable: true
      },
      options || {}
    )
    this.chunks = Math.ceil(this.file.size / this.opt.chunkSize)
    console.log(`chunks:${this.chunks}`)
    this.blobSlice =
      File.prototype.slice ||
      File.prototype.mozSlice ||
      File.prototype.webkitSlice
    this.file.md5 = ''
  }

  run() {
    this.md5File().then(res => {
      this.exec()
    })
  }

  /**
   * 执行任务
   */
  exec() {
    let start = this.getCurrentChunk(this.file.md5)
    this.upload(start)
  }

  /**
   * 暂停任务
   */
  pause() {
    this.state = STATE.PAUSE
  }

  /**
   * 继续上传
   */
  continue() {
    this.state = STATE.WORKING
    this.exec()
  }

  /**
   * 重新开始
   */
  restart() {
    this.state = STATE.WORKING
    localStorage.setItem(
      this.file.md5,
      JSON.stringify({
        time: this.getBeautifyDate(),
        chunk: 0
      })
    )
    this.exec()
  }

  /**
   * 取消任务
   */
  cancel() {
    this.state = STATE.DELETE
    this.opt.cancel()
  }

  /**
   * 给文件md5,保证唯一性
   */
  md5File() {
    return new Promise((resolve, reject) => {
      if (this.opt.unique) {
        let currentChunk = 0,
          spark = new SparkMD5.ArrayBuffer(),
          fileReader = new FileReader()

        fileReader.onload = e => {
          this.opt.progress(
            STATUS.READ_SUCCESS,
            Math.floor((currentChunk / this.chunks) * 100)
          )
          spark.append(e.target.result) // Append array buffer
          currentChunk++
          if (currentChunk < this.chunks) {
            this.loadNext(currentChunk, fileReader)
          } else {
            console.log('finished loading')
            let result = spark.end()
            this.file.md5 = result
            this.opt.progress(STATUS.READ_SUCCESS, 100)
            resolve(result)
          }
        }

        fileReader.onerror = function() {
          console.warn('oops, something went wrong.')
          this.opt.progress(STATUS.READ_FAIL)
        }

        this.loadNext(currentChunk, fileReader)
      } else {
        let md5 = SparkMD5.hash(
          `${this.file.name}-${this.file.size}-${Date.now()}`
        )
        console.log(md5)
        this.file.md5 = md5
        resolve(md5)
      }
    })
  }

  /**
   * 根据文件md5值获取当前chunk块
   * @param {*} md5
   */
  getCurrentChunk(md5) {
    let fileChunkPosition = JSON.parse(localStorage.getItem(md5))
    if (!fileChunkPosition) {
      fileChunkPosition = { time: this.getBeautifyDate(), chunk: 0 }
      localStorage.setItem(md5, JSON.stringify(fileChunkPosition))
    }
    return fileChunkPosition.chunk
  }

  /**
   * 上传
   * @param {*} index
   */
  upload(index) {
    // console.log('起始下标：' + index)
    if (this.state != STATE.WORKING) {
      console.log('当前状态：', this.state)
      return
    }
    this.sendToServer(index)
      .then(res => {
        if (res.success) {
          if (index == this.chunks - 1) {
            if (this.opt.clearable) {
              localStorage.removeItem(this.file.md5)
            }
            this.opt.progress(STATUS.UPLOAD_SUCCESS, 100)
            this.opt.complete(this.file)
            return
          }
          let radio = Math.floor(((index + 1) / this.chunks) * 100)
          this.opt.progress(STATUS.UPLOAD_SUCCESS, radio)
          localStorage.setItem(
            this.file.md5,
            JSON.stringify({
              time: this.getBeautifyDate(),
              chunk: res.index + 1
            })
          )
          index++
          this.upload(index)
        }
      })
      .catch(e => {
        this.opt.progress(STATUS.UPLOAD_FAIL)
      })
  }

  /**
   * 发送数据
   * @param {*} index
   */
  sendToServer(index) {
    return new Promise((resolve, reject) => {
      let startSliceSize = index * this.opt.chunkSize,
        nextSliceSize = (index + 1) * this.opt.chunkSize
      let endSliceSize =
        nextSliceSize >= this.file.size ? this.file.size : nextSliceSize
      console.log(
        this.file.name,
        index,
        `${startSliceSize / 1024 / 1024}MB`,
        `${endSliceSize / 1024 / 1024}MB`
      )
      let form = new FormData()
      form.append('data', this.file.slice(startSliceSize, endSliceSize))
      // form.append('fileName', this.file.name)
      form.append('total', this.chunks) //总片数
      form.append('index', index + 1) //当前是第几片
      form.append('fileMd5Value', this.file.md5)
      var xhr = new XMLHttpRequest(),
        ot,
        oloaded
      xhr.open('POST', this.opt.url, true)
      xhr.onload = e => {
        let target = e.target
        if (target.status == 200) {
          resolve({
            success: true,
            index: index
          })
        } else {
          reject()
        }
      }
      xhr.onerror = e => {
        reject()
      }
      xhr.upload.onprogress = evt => {
        var pertime = (Date.now() - ot) / 1000,
          perload = evt.loaded - oloaded,
          speed = perload / pertime
        var units = 'b/s' //单位名称
        if (speed / 1024 > 1) {
          speed = speed / 1024
          units = 'k/s'
        }
        if (speed / 1024 > 1) {
          speed = speed / 1024
          units = 'M/s'
        }
        this.opt.getSpeed(speed.toFixed(1) + units)
        ot = new Date().getTime()
        oloaded = evt.loaded
      }
      xhr.upload.onloadstart = evt => {
        ot = new Date().getTime() //设置上传开始时间
        oloaded = 0
      }

      xhr.send(form)
    })
  }

  /**
   * 读取文件
   * @param {*} currentChunk
   * @param {*} fileReader
   */
  loadNext(currentChunk, fileReader) {
    if (this.state != STATE.WORKING) return
    var start = currentChunk * this.opt.chunkSize,
      end =
        start + this.opt.chunkSize >= this.file.size
          ? this.file.size
          : start + this.opt.chunkSize

    fileReader.readAsArrayBuffer(this.blobSlice.call(this.file, start, end))
  }

  /**
   * 工具方法，格式化日期
   */
  getBeautifyDate() {
    let now = new Date()
    var year = now.getFullYear(),
      month = now.getMonth() + 1,
      date = now.getDate(),
      hour = now.getHours(),
      minute = now.getMinutes(),
      second = now.getSeconds()
    return (
      year + '-' + month + '-' + date + ' ' + hour + ':' + minute + ':' + second
    )
  }
}
