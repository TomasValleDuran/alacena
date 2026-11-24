// Vercel's Express preset only accepts an entrypoint that imports express itself,
// so the app instance is created here and configured by createApp.
import express from 'express'
import { createApp } from './create-app.js'

const port = Number(process.env.PORT ?? 3001)
createApp(express()).listen(port, () => console.log(`[alacena] API on http://localhost:${port}`))
