
import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import * as cocoSsd from '@tensorflow-models/coco-ssd'

let model: cocoSsd.ObjectDetection | null = null

export async function loadDetectionModel() {
  if (model) return model

  await tf.setBackend('webgl')
  await tf.ready()

  model = await cocoSsd.load({
    base: 'lite_mobilenet_v2',
  })

  console.log('COCO-SSD model loaded successfully')

  return model
}

export async function detectObjects(video: HTMLVideoElement) {
  const detectionModel = await loadDetectionModel()
  return detectionModel.detect(video)
}
