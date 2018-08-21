var express = require('express')
var router = express.Router()
var path = require('path')
var marked = require('marked')

let formidable = require('formidable')
let fs = require('fs-extra')
let fs0 = require('fs')
let concat = require('concat-files')
let opn = require('opn')
let uploadDir = 'files/chunks'
let routers = require('../public/javascripts/router')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Examples', navList: routers })
})

routers.map(item => {
  router.get(`/${item.url}`, (req, res, next) => {
    if (item.article) {
      let article = path.join(__dirname, `../markdown/${item.article}`)
      fs0.readFile(article, function(err, data) {
        var html = marked(data.toString())
        res.render(item.url, {
          title: item.name,
          content: html,
          readonly: item.readonly
        })
      })
    } else {
      res.render(item.url, { title: item.name })
    }
  })
})

// 上传文件
router.post('/upload', (req, res) => {
  var form = new formidable.IncomingForm({
    uploadDir: './files/tmp'
  })
  form.parse(req, function(err, fields, file) {
    let index = fields.index
    let total = fields.total
    let fileMd5Value = fields.fileMd5Value
    let folder = path.resolve(__dirname, '../files/chunks', fileMd5Value)
    console.log('folder', folder)
    folderIsExit(folder).then(val => {
      let destFile = path.resolve(folder, fields.index)
      console.log('temp path', file.data.path)
      console.log('目标目录：', destFile)
      copyFile(file.data.path, destFile).then(
        successLog => {
          console.log(successLog)
          res.send({ stat: 1, desc: index })
        },
        errorLog => {
          res.send({ stat: 0, desc: 'Error' })
        }
      )
    })
  })
  // 文件夹是否存在, 不存在则创建文件
  function folderIsExit(folder) {
    return new Promise(async (resolve, reject) => {
      let result = await fs.ensureDirSync(path.join(folder))
      console.log('folderIsExit：', result)
      resolve(true)
    })
  }
  // 把文件从一个目录拷贝到别一个目录
  function copyFile(src, dest) {
    console.log('rename', src, dest)
    let promise = new Promise((resolve, reject) => {
      fs.rename(src, dest, err => {
        console.log('rename', src, dest)
        if (err) {
          reject(err)
        } else {
          resolve('copy file:' + dest + ' success!')
        }
      })
    })
    return promise
  }
})

// 合并文件
router.get('/merge', (req, res) => {
  let query = req.query
  let md5 = query.md5
  let size = query.size
  let fileName = query.fileName
  console.log('merge:', md5, fileName)
  mergeFiles(path.join(uploadDir, md5), uploadDir, fileName, size)
  res.send({ stat: 1 })
})

// 合并文件
async function mergeFiles(srcDir, targetDir, newFileName, size) {
  console.log(...arguments)
  let targetStream = fs.createWriteStream(path.join(targetDir, newFileName))
  let fileArr = await listDir(srcDir)
  // 把文件名加上文件夹的前缀
  for (let i = 0; i < fileArr.length; i++) {
    fileArr[i] = srcDir + '/' + fileArr[i]
  }
  console.log(fileArr)
  concat(fileArr, path.join(targetDir, newFileName), () => {
    console.log('Merge Success!')
  })
}

function listDir(path) {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, data) => {
      if (err) {
        reject(err)
        return
      }
      // 把mac系统下的临时文件去掉
      if (data && data.length > 0 && data[0] === '.DS_Store') {
        data.splice(0, 1)
      }
      resolve(data)
    })
  })
}

module.exports = router
