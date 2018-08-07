function init(bucketName) {
  let accessKeyId = 'AKIAPYLTJBBQPZPXKGWQ',
    secretAccessKey = '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',
    region = 'cn-north-1',
    bucket = bucketName || 'cloudwalk-doc'
  AWS.config.update({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    region: region
  })
  let aws = new AWS.S3({ params: { Bucket: bucket } })
  return aws
}
let awsOperator = null
export const Uploader = {
  upload(name, file, callback) {
    if (!awsOperator) {
      awsOperator = init(name)
    }
    let params = {
      Key: uuid.v1() + '.' + file.type.split('/')[1],
      Body: file,
      ContentType: file.type,
      ACL: 'public-read'
    }
    awsOperator
      .upload(params)
      .on('httpUploadProgress', function(evt) {})
      .send(function(err, data) {
        if (err) {
          console.log(err)
        } else {
          callback(data.Location)
        }
      })
  }
}
