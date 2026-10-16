// Cloudflare Pages Function: the same handler as api/camera-time.ts on Vercel,
// reporting when a camera host last changed an image (its Last-Modified header).
import { GET } from '../api/camera-time'

export const onRequestGet = ({ request }: { request: Request }) => GET(request)
