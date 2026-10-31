
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
  // minScore 0.35 (default 0.5): an object right in front of the camera is cut off by the frame edges,
  // which makes the model less sure. We still want it, because that is exactly when to warn.
  return detectionModel.detect(video, 20, 0.35)
}
