'use client'

import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hue: number
  pulse: number
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function BackgroundVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let width = 0
    let height = 0
    let frame = 0
    let raf = 0
    let particles: Particle[] = []
    const reducedMotion = prefersReducedMotion()

    const seedParticles = () => {
      const count = Math.min(96, Math.max(42, Math.floor((width * height) / 18000)))

      particles = Array.from({ length: count }, (_, index) => {
        const lane = index / count
        const angle = lane * Math.PI * 6

        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * (0.12 + Math.random() * 0.22),
          vy: Math.sin(angle) * (0.1 + Math.random() * 0.18),
          size: 1.1 + Math.random() * 2.7,
          hue: 178 + Math.random() * 92,
          pulse: Math.random() * Math.PI * 2,
        }
      })
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedParticles()
    }

    const drawGradient = (time: number) => {
      const flow = Math.sin(time * 0.0002)
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#f7fbff')
      gradient.addColorStop(0.36 + flow * 0.04, '#dff7f0')
      gradient.addColorStop(0.68, '#eef0ff')
      gradient.addColorStop(1, '#fff8f1')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      const glowA = ctx.createRadialGradient(
        width * (0.18 + flow * 0.08),
        height * 0.2,
        0,
        width * 0.2,
        height * 0.18,
        Math.max(width, height) * 0.6,
      )
      glowA.addColorStop(0, 'rgba(45, 212, 191, 0.26)')
      glowA.addColorStop(1, 'rgba(45, 212, 191, 0)')
      ctx.fillStyle = glowA
      ctx.fillRect(0, 0, width, height)

      const glowB = ctx.createRadialGradient(
        width * 0.82,
        height * (0.72 - flow * 0.05),
        0,
        width * 0.82,
        height * 0.72,
        Math.max(width, height) * 0.5,
      )
      glowB.addColorStop(0, 'rgba(99, 102, 241, 0.18)')
      glowB.addColorStop(1, 'rgba(99, 102, 241, 0)')
      ctx.fillStyle = glowB
      ctx.fillRect(0, 0, width, height)
    }

    const drawDataRibbons = (time: number) => {
      ctx.save()
      ctx.globalAlpha = 0.3

      for (let band = 0; band < 5; band += 1) {
        const yBase = height * (0.14 + band * 0.18)
        const speed = time * (0.00012 + band * 0.000018)
        ctx.beginPath()

        for (let x = -20; x <= width + 20; x += 18) {
          const y =
            yBase +
            Math.sin(x * 0.009 + speed * 9 + band) * 26 +
            Math.sin(x * 0.021 - speed * 6) * 9

          if (x === -20) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }

        ctx.strokeStyle = band % 2 === 0 ? 'rgba(20, 184, 166, 0.42)' : 'rgba(79, 70, 229, 0.28)'
        ctx.lineWidth = band % 2 === 0 ? 1.4 : 1
        ctx.stroke()
      }

      ctx.restore()
    }

    const drawParticles = (time: number) => {
      for (let i = 0; i < particles.length; i += 1) {
        const point = particles[i]

        if (!reducedMotion) {
          const drift = Math.sin(time * 0.0005 + point.pulse)
          point.x += point.vx + drift * 0.08
          point.y += point.vy + Math.cos(time * 0.0004 + point.pulse) * 0.08
        }

        if (point.x < -30) point.x = width + 30
        if (point.x > width + 30) point.x = -30
        if (point.y < -30) point.y = height + 30
        if (point.y > height + 30) point.y = -30

        for (let j = i + 1; j < particles.length; j += 1) {
          const neighbor = particles[j]
          const dx = point.x - neighbor.x
          const dy = point.y - neighbor.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const maxDistance = Math.min(170, width * 0.13)

          if (distance < maxDistance) {
            ctx.globalAlpha = (1 - distance / maxDistance) * 0.22
            ctx.strokeStyle = 'rgba(15, 118, 110, 0.65)'
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(point.x, point.y)
            ctx.lineTo(neighbor.x, neighbor.y)
            ctx.stroke()
          }
        }

        const pulse = 0.65 + Math.sin(time * 0.002 + point.pulse) * 0.35
        ctx.globalAlpha = 0.38 + pulse * 0.28
        ctx.fillStyle = `hsl(${point.hue}, 70%, 48%)`
        ctx.beginPath()
        ctx.arc(point.x, point.y, point.size + pulse * 1.4, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
    }

    const drawScanner = (time: number) => {
      const x = ((time * 0.025) % (width + 260)) - 130
      const scanner = ctx.createLinearGradient(x - 90, 0, x + 90, 0)
      scanner.addColorStop(0, 'rgba(255, 255, 255, 0)')
      scanner.addColorStop(0.5, 'rgba(255, 255, 255, 0.32)')
      scanner.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = scanner
      ctx.fillRect(x - 90, 0, 180, height)
    }

    const draw = (time: number) => {
      frame += 1
      drawGradient(time)
      drawDataRibbons(time)
      drawParticles(time)
      drawScanner(time)

      if (!reducedMotion || frame < 2) {
        raf = window.requestAnimationFrame(draw)
      }
    }

    resize()
    raf = window.requestAnimationFrame(draw)
    window.addEventListener('resize', resize)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#f7fbff]">
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.48),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.5))]" />
    </div>
  )
}
