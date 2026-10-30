
const express = require('express')
const { spawn } = require('child_process')
const fs = require('fs').promises
const os = require('os')
const path = require('path')

const router = express.Router()

const TOKEN = process.env.STICKER_API_TOKEN || 'wow'

// ======================================================
// AUTENTICACIÓN
// ======================================================

function authenticate(req, res, next) {
  const token =
    req.headers['x-api-key'] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token || token !== TOKEN) {
    return res.status(401).json({
      error: 'Token inválido.'
    })
  }

  next()
}

// ======================================================
// EJECUTAR FFMPEG
// ======================================================

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''
    let finished = false

    const finish = (fn, value) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      fn(value)
    }

    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      finish(reject, new Error('Tiempo de conversión agotado.'))
    }, 120000)

    proc.stderr.on('data', data => {
      stderr += data.toString()
      stderr = stderr.slice(-10000)
    })

    proc.on('error', error => finish(reject, error))

    proc.on('close', code => {
      if (code === 0) {
        finish(resolve)
      } else {
        finish(reject, new Error(stderr || 'Error de FFmpeg.'))
      }
    })
  })
}

// ======================================================
// CONVERTIR A WEBP CUADRADO
// ======================================================

async function convertSticker(buffer, isVideo = false) {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'chuchobot-')
  )

  const input = path.join(dir, 'input')
  const output = path.join(dir, 'output.webp')

  try {
    await fs.writeFile(input, buffer)

    const filters = [
      'scale=512:512:force_original_aspect_ratio=decrease',
      'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0',
      'setsar=1',
      'format=yuva420p'
    ].join(',')

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', input,
      '-vf', filters,
      '-an'
    ]

    if (isVideo) {
      args.push('-t', '20')
    }

    args.push(
      '-c:v', isVideo ? 'libwebp_anim' : 'libwebp',
      '-lossless', '0',
      '-q:v', '80',
      '-compression_level', '6'
    )

    if (isVideo) {
      args.push('-loop', '0')
    }

    args.push(output)

    await runFFmpeg(args)

    const result = await fs.readFile(output)

    if (result.length < 100) {
      throw new Error('El WebP generado está vacío.')
    }

    return result

  } finally {
    await fs.rm(dir, {
      recursive: true,
      force: true
    }).catch(() => {})
  }
}

// ======================================================
// RECIBIR ARCHIVO
// ======================================================

router.post(
  '/convert',
  authenticate,
  express.raw({
    type: 'application/octet-stream',
    limit: '30mb'
  }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({
          error: 'No se recibió ningún archivo.'
        })
      }

      const isVideo = req.headers['x-media-type'] === 'video'

      const result = await convertSticker(req.body, isVideo)

      res.set({
        'Content-Type': 'image/webp',
        'Content-Length': result.length,
        'Content-Disposition': 'attachment; filename="sticker.webp"',
        'Cache-Control': 'no-store'
      })

      res.send(result)

    } catch (error) {
      console.error('[STICKER]', error)

      res.status(500).json({
        error: 'No se pudo convertir el archivo.'
      })
    }
  }
)

// ======================================================
// ESTADO
// ======================================================

router.get('/status', authenticate, async (req, res) => {
  try {
    await runFFmpeg(['-version'])

    res.json({
      success: true,
      ffmpeg: true,
      format: 'webp',
      ratio: '1:1',
      size: '512x512'
    })

  } catch {
    res.status(503).json({
      success: false,
      ffmpeg: false
    })
  }
})

module.exports = router
