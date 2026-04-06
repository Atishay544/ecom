'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// All hero slides share this exact height — enforced via CSS variable
const SLIDE_HEIGHT = 'h-[420px] sm:h-[500px] md:h-[560px] lg:h-[620px]'

interface Banner {
  id: string
  display_style: string | null
  title: string | null
  subtitle: string | null
  image_url: string | null
  link_url: string | null
  link_text: string | null
  bg_color: string | null
  text_color: string | null
}

export default function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)
  const count = banners.length

  const next = useCallback(() => {
    setDirection(1)
    setCurrent(c => (c + 1) % count)
  }, [count])

  const prev = () => {
    setDirection(-1)
    setCurrent(c => (c - 1 + count) % count)
  }

  const goTo = (i: number) => {
    setDirection(i > current ? 1 : -1)
    setCurrent(i)
  }

  useEffect(() => {
    if (count <= 1) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [count, next])

  // ── Fallback (no banners) ─────────────────────────────────────────────────
  if (count === 0) {
    return (
      <section className={`relative overflow-hidden ${SLIDE_HEIGHT} bg-gray-900 text-white flex items-center justify-center`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black" />
        <div className="relative z-10 text-center px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-4 opacity-60">Official Store</p>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight tracking-tight">New Season Arrivals</h1>
          <p className="text-base md:text-lg mb-8 opacity-70 max-w-lg mx-auto">Discover the latest styles at unbeatable prices</p>
          <Link href="/products"
            className="inline-flex items-center gap-2 border-2 border-white/80 text-white px-8 py-3.5 rounded-full font-semibold hover:bg-white hover:text-gray-900 transition-all duration-300 active:scale-95">
            Shop Now
          </Link>
        </div>
      </section>
    )
  }

  const slide = banners[current]

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
    exit:   (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
  }

  return (
    <section className={`relative overflow-hidden ${SLIDE_HEIGHT}`}>
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={slide.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          <SlideRenderer slide={slide} height={SLIDE_HEIGHT} />
        </motion.div>
      </AnimatePresence>

      {/* ── Arrows ── */}
      {count > 1 && (
        <>
          <button onClick={prev} aria-label="Previous banner"
            className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/25 hover:bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-95">
            <ChevronLeft size={22} />
          </button>
          <button onClick={next} aria-label="Next banner"
            className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/25 hover:bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-95">
            <ChevronRight size={22} />
          </button>

          {/* ── Dots ── */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {banners.map((b, i) => (
              <button key={b.id} onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-7 h-2.5 bg-white shadow-sm'
                    : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
                }`} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ── Slide types — all rendered inside the SAME height wrapper ─────────────────
function SlideRenderer({ slide, height }: { slide: Banner; height: string }) {
  const style = slide.display_style ?? 'overlay'
  const bg    = slide.bg_color   ?? '#111827'
  const color = slide.text_color ?? '#ffffff'
  const link  = slide.link_url   ?? '/products'

  // ── Image Only ──────────────────────────────────────────────────────────────
  if (style === 'image_only') {
    return (
      <Link href={link} className={`block relative w-full h-full group`}>
        {slide.image_url
          ? <Image src={slide.image_url} alt="banner" fill sizes="100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]" priority />
          : <div className="w-full h-full bg-gray-200" />}
      </Link>
    )
  }

  // ── Solid Color ──────────────────────────────────────────────────────────────
  if (style === 'solid') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-6"
        style={{ backgroundColor: bg, color }}>
        {slide.title && (
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight tracking-tight">
            {slide.title}
          </h1>
        )}
        {slide.subtitle && (
          <p className="text-base md:text-xl mb-8 opacity-80 max-w-xl">{slide.subtitle}</p>
        )}
        {slide.link_text && (
          <Link href={link}
            className="inline-flex items-center gap-2 border-2 px-8 py-3.5 rounded-full font-semibold hover:opacity-80 transition-all duration-200 active:scale-95"
            style={{ borderColor: color, color }}>
            {slide.link_text}
          </Link>
        )}
      </div>
    )
  }

  // ── Smoky Overlay (default) ──────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center text-center px-6 overflow-hidden"
      style={{ backgroundColor: bg, color }}>
      {slide.image_url && (
        <Image src={slide.image_url} alt={slide.title ?? 'banner'} fill sizes="100vw"
          className="object-cover opacity-40 scale-[1.02]" priority />
      )}
      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      <div className="relative z-10">
        {slide.title && (
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight tracking-tight drop-shadow-lg"
            style={{ color }}>
            {slide.title}
          </h1>
        )}
        {slide.subtitle && (
          <p className="text-base md:text-xl mb-8 opacity-90 max-w-xl mx-auto drop-shadow"
            style={{ color }}>
            {slide.subtitle}
          </p>
        )}
        {slide.link_text && (
          <Link href={link}
            className="inline-flex items-center gap-2 border-2 px-8 py-3.5 rounded-full font-semibold backdrop-blur-sm hover:bg-white hover:text-gray-900 transition-all duration-300 active:scale-95"
            style={{ borderColor: color, color }}>
            {slide.link_text}
          </Link>
        )}
      </div>
    </div>
  )
}
