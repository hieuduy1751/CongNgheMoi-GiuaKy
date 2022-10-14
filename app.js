import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import data from './store.js'
import multer from 'multer'
import AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import S3 from 'aws-sdk'
import path from 'node:path'
const app = express()
const port = 3000
const config = new AWS.Config({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})
AWS.config = config

const docClient = new AWS.DynamoDB.DocumentClient()

const TABLE_NAME = 'SanPham'
const CLOUD_FRONT_URL = process.env.CLOUD_FRONT_URL
const s3 = new AWS.S3()

const storage = multer.memoryStorage({
  destination: function (req, file, cb) {
    cb(null, '')
  }
})

const checkFileType = (file, cb) => {
  const fileTypes = /jpeg|jpg|png|gif/

  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase())
  const minetype = fileTypes.test(file.mimetype)
  console.log(file)
  if (extname && minetype) {
    return cb(null, true)
  }

  return cb("Error: Image only")
}

const upload = multer({
  storage,
  limits: { fileSize: 2000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb)
  }
})

app.use(express.static('./templates'))
app.set('view engine', 'ejs')
app.set('views', './templates')

app.get('/', (req, res) => {
  const params = {
    TableName: TABLE_NAME
  }

  docClient.scan(params, (err, data) => {
    if (err) {
      console.log(err)
      return res.send('Internal Server Error')
    } else {
      return res.render('index', { data: data.Items })
    }
  })
})

app.post('/', upload.single('image'), (req, res) => {
  const { ma_sp, ten_sp, so_luong } = req.body
  const image = req.file.originalname.split('.')

  const fileType = image[image.length - 1]

  const filePath = `${uuidv4() + Date.now().toString()}.${fileType}`
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filePath,
    Body: req.file.buffer
  }

  s3.upload(params, (err, data) => {
    if (err) {
      console.log(err)
      return res.send('Internal server error')
    } else {
      const newItem = {
        TableName: TABLE_NAME,
        Item: {
          ma_sp,
          ten_sp,
          so_luong,
          hinh_anh: `${CLOUD_FRONT_URL}/${filePath}`
        }
      }
      docClient.put(newItem, (err, data) => {
        if (err) {
          console.log(err)
          return res.send('Internal Server Error')
        } else {
          return res.redirect('/')
        }
      })
    }
  })
})

app.post('/edit/:id', upload.single('image'), (req, res) => {
  const ma_sp = req.params.id
  const { ten_sp, so_luong } = req.body

  const image = req.file.originalname.split('.')

  const fileType = image[image.length - 1]

  const filePath = `${uuidv4() + Date.now().toString()}.${fileType}`

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filePath,
    Body: req.file.buffer
  }

  s3.upload(params, (err, data) => {
    if (err) {
      console.log(err)
      return res.send('Internal server error')
    } else {
      const newItem = {
        TableName: TABLE_NAME,
        Item: {
          ma_sp,
          ten_sp,
          so_luong,
          hinh_anh: `${CLOUD_FRONT_URL}/${filePath}`
        }
      }
      docClient.put(newItem, (err, data) => {
        if (err) {
          console.log(err)
          return res.send('Internal Server Error')
        } else {
          return res.redirect('/')
        }
      })
    }
  })
})

app.post('/delete/:id', (req, res) => {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      ma_sp: req.params.id
    }
  }

  docClient.delete(params, (err, data) => {
    if (err) {
      console.log(err)
      return res.send('Internal Server Error')
    } else {
      return res.redirect('/')
    }
  })
})

app.listen(port, () => {
  console.log(`Server listening at port ${port}`)
})
