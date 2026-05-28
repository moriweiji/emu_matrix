<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-white mb-8">个人中心</h1>

    <div v-if="authStore.user" class="card p-6 mb-8">
      <div class="flex items-center space-x-6">
        <div class="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center text-3xl">
          {{ authStore.user.username.charAt(0).toUpperCase() }}
        </div>
        <div>
          <h2 class="text-2xl font-bold text-white">{{ authStore.user.username }}</h2>
          <p class="text-gray-400">{{ authStore.user.email }}</p>
          <p class="text-gray-500 text-sm">注册于 {{ formatDate(authStore.user.created_at) }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <router-link to="/saves" class="card p-6 hover:border-primary-500 transition-colors cursor-pointer">
        <div class="text-4xl mb-3">💾</div>
        <h3 class="text-lg font-semibold text-white">云存档</h3>
        <p class="text-gray-400 text-sm mt-1">管理你的游戏存档，跨设备同步</p>
      </router-link>

      <router-link to="/screenshots" class="card p-6 hover:border-primary-500 transition-colors cursor-pointer">
        <div class="text-4xl mb-3">📸</div>
        <h3 class="text-lg font-semibold text-white">云截图</h3>
        <p class="text-gray-400 text-sm mt-1">查看和管理你的游戏截图</p>
      </router-link>

      <router-link to="/recordings" class="card p-6 hover:border-primary-500 transition-colors cursor-pointer">
        <div class="text-4xl mb-3">🎬</div>
        <h3 class="text-lg font-semibold text-white">云录像</h3>
        <p class="text-gray-400 text-sm mt-1">回放你的精彩游戏时刻</p>
      </router-link>
    </div>

    <div class="mt-8">
      <h2 class="text-xl font-semibold text-white mb-4">我的收藏</h2>
      <div v-if="favoriteGames.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div
          v-for="game in favoriteGames"
          :key="game.id"
          @click="$router.push({ name: 'game-room', params: { id: game.id } })"
          class="card p-3 cursor-pointer hover:border-primary-500 transition-colors group"
        >
          <div class="aspect-square bg-gray-700 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
            <img v-if="game.cover_url" :src="game.cover_url" :alt="game.name" class="w-full h-full object-cover" />
            <span v-else class="text-4xl">🎮</span>
            <button
              @click.stop="toggleFavorite(game.id)"
              class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors z-10"
              title="取消收藏"
            >
              <svg
                class="w-4 h-4 text-yellow-400 fill-yellow-400"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>
          <p class="text-sm font-medium text-white truncate">{{ game.name }}</p>
        </div>
      </div>
      <div v-else class="text-gray-500 text-center py-8">暂无收藏游戏</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'

const authStore = useAuthStore()
const gameStore = useGameStore()
const favoriteGames = ref(gameStore.favoriteGames)

watch(() => gameStore.favoriteGames, (v) => { favoriteGames.value = v })

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}

async function toggleFavorite(gameId: string) {
  await gameStore.toggleFavorite(gameId)
}

onMounted(() => {
  gameStore.fetchFavorites()
})
</script>
