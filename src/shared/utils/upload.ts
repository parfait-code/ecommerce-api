import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../config/storage'
import { env } from '../config/env'
import crypto from 'crypto'
import path from 'path'

const BUCKET = env.R2_BUCKET_PRODUCTS

export const uploadImage = async (
  file: Express.Multer.File,
  folder: string = 'products',
): Promise<string> => {
  const ext = path.extname(file.originalname)
  const key = `${folder}/${crypto.randomUUID()}${ext}`

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  )

  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${key}`
}

export const deleteImage = async (url: string): Promise<void> => {
  const key = url.split(`/${BUCKET}/`)[1]
  if (!key) return

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  )
}