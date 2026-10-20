<script setup>
// The flag of Cambodia, drawn inline: the 🇰🇭 emoji shows as the letters "KH" on Windows.
defineProps({ height: { type: Number, default: 14 } })
</script>

<template>
  <svg
    :height="height"
    :width="height * 1.5"
    viewBox="0 0 30 20"
    role="img"
    aria-label="Flag of Cambodia"
    class="inline-block shrink-0 overflow-hidden rounded-[2px] align-[-2px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.25)]"
  >
    <rect width="30" height="20" fill="#032EA1" />
    <rect y="5" width="30" height="10" fill="#E00025" />
    <!-- Angkor Wat -->
    <g fill="#fff">
      <rect x="7.5" y="13.2" width="15" height="0.9" />
      <rect x="8.6" y="11.4" width="12.8" height="1.9" />
      <path d="M15 6.2 16.2 8.6v2.8h-2.4V8.6Z" />
      <path d="M11.8 7.9 12.8 9.6v1.8h-2V9.6Z" />
      <path d="M18.2 7.9 19.2 9.6v1.8h-2V9.6Z" />
      <path d="M9.4 9.4 10.2 10.5v0.9H8.6v-0.9Z" />
      <path d="M20.6 9.4 21.4 10.5v0.9h-1.6v-0.9Z" />
    </g>
  </svg>
</template>
