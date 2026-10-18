// Cloudflare Pages Function: the same handler as /api/camera-time on Vercel
// (api/_lib/endpoints/camera-time.ts), reporting when a camera host last
// changed an image (its Last-Modified header).
import { GET } from '../../api/_lib/endpoints/camera-time'

export const onRequestGet = ({ request }: { request: Request }) => GET(request)
