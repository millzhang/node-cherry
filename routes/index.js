var express = require('express')
var router = express.Router()
var path = require('path')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Examples' })
})

// 文件上传
router.get('/fileupload', (req, res, next) => {
  res.render('fileupload', { title: 'AWS文件批量上传' })
})

// 文件夹上传
router.get('/folderupload', (req, res, next) => {
  res.render('folderupload', { title: 'AWS指定目录文件批量上传' })
})

module.exports = router
