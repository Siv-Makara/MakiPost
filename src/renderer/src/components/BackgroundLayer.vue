<script setup>
import { computed } from 'vue'
import { useAppearanceStore } from '@/stores/appearance'

const store = useAppearanceStore()
const bg = computed(() => store.appearance.background)

const imageStyle = computed(() => {
  const { image, fit, blur } = bg.value
  return {
    backgroundImage: `url('sar-bg://image/${encodeURIComponent(image)}')`,
    backgroundSize: fit === 'tile' ? 'auto' : fit,
    backgroundRepeat: fit === 'tile' ? 'repeat' : 'no-repeat',
    backgroundPosition: 'center',
    filter: blur ? `blur(${blur}px)` : 'none',
    // Scale up slightly when blurred so soft edges stay off-screen.
    transform: blur ? `scale(${1 + blur / 200})` : 'none'
  }
})
</script>

<template>
  <div v-if="bg.image" class="pointer-events-none fixed inset-0 overflow-hidden">
    <div class="absolute inset-0" :style="imageStyle"></div>
    <div class="absolute inset-0" :style="{ background: `rgb(var(--sar-bg) / ${bg.overlay})` }"></div>
  </div>
</template>
