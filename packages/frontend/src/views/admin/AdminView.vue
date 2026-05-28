<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-white mb-2">管理后台</h1>
      <p class="text-gray-400">ROM 管理与操作日志</p>
    </div>

    <div class="flex border-b border-gray-700 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key"
        :class="[
          'px-6 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
          activeTab === tab.key
            ? 'border-primary-500 text-primary-400'
            : 'border-transparent text-gray-400 hover:text-gray-200'
        ]"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="activeTab === 'roms'">
      <div class="card p-4 mb-6">
        <div class="flex flex-col lg:flex-row gap-3 flex-wrap">
          <input
            v-model="romQuery.search"
            type="text"
            class="input-field lg:w-64"
            placeholder="搜索名称/版本/设备型号..."
            @input="debounceFetchRoms"
          />
          <select v-model="romQuery.platform" class="input-field lg:w-40" @change="fetchRoms">
            <option value="">全部平台</option>
            <option v-for="p in VALID_PLATFORMS" :key="p" :value="p">{{ PLATFORM_LABELS[p] }}</option>
          </select>
          <select v-model="romQuery.status" class="input-field lg:w-32" @change="fetchRoms">
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
          <select v-model="romQuery.isDeleted" class="input-field lg:w-32" @change="fetchRoms">
            <option value="">全部</option>
            <option value="false">正常</option>
            <option value="true">已删除</option>
          </select>
          <input
            v-model="romQuery.startDate"
            type="date"
            class="input-field lg:w-44"
            @change="fetchRoms"
          />
          <input
            v-model="romQuery.endDate"
            type="date"
            class="input-field lg:w-44"
            @change="fetchRoms"
          />
          <div class="flex gap-2 ml-auto">
            <button class="btn-primary" @click="openUploadModal">上传 ROM</button>
            <button
              v-if="selectedIds.length > 0"
              class="btn-danger"
              @click="confirmBatchDelete"
            >
              批量删除 ({{ selectedIds.length }})
            </button>
          </div>
        </div>
      </div>

      <div class="card overflow-hidden mb-6">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-700 text-gray-400 text-left">
                <th class="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    :indeterminate="isPartialSelected"
                    @change="toggleSelectAll"
                    class="rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th class="px-4 py-3 w-14">封面</th>
                <th class="px-4 py-3">名称</th>
                <th class="px-4 py-3">英文名</th>
                <th class="px-4 py-3">平台</th>
                <th class="px-4 py-3">分类</th>
                <th class="px-4 py-3">版本</th>
                <th class="px-4 py-3">设备型号</th>
                <th class="px-4 py-3">状态</th>
                <th class="px-4 py-3">上传时间</th>
                <th class="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="game in romList"
                :key="game.id"
                class="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td class="px-4 py-3">
                  <input
                    type="checkbox"
                    :value="game.id"
                    v-model="selectedIds"
                    class="rounded bg-gray-700 border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td class="px-4 py-3">
                  <div class="w-10 h-10 rounded overflow-hidden flex items-center justify-center bg-gray-700 flex-shrink-0">
                    <img
                      v-if="game.cover_url"
                      :src="game.cover_url"
                      :alt="game.name"
                      loading="lazy"
                      class="w-full h-full object-cover"
                      @error="handleCoverError($event)"
                    />
                    <span v-else class="text-lg">🎮</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-white font-medium">{{ game.name }}</td>
                <td class="px-4 py-3 text-gray-400">{{ game.name_en || '-' }}</td>
                <td class="px-4 py-3">
                  <span :class="platformBadgeClass(game.platform)">{{ PLATFORM_LABELS[game.platform] || game.platform }}</span>
                </td>
                <td class="px-4 py-3 text-gray-400">{{ game.category || '-' }}</td>
                <td class="px-4 py-3 text-gray-400">{{ (game as any).version || '-' }}</td>
                <td class="px-4 py-3 text-gray-400">{{ (game as any).device_model || '-' }}</td>
                <td class="px-4 py-3">
                  <span v-if="(game as any).is_deleted" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">已删除</span>
                  <span v-else-if="game.status === 'active'" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">启用</span>
                  <span v-else class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">停用</span>
                </td>
                <td class="px-4 py-3 text-gray-400 whitespace-nowrap">{{ formatDate(game.created_at) }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <button class="text-primary-400 hover:text-primary-300 text-xs font-medium" @click="openEditModal(game)">编辑</button>
                    <button
                      v-if="!(game as any).is_deleted"
                      class="text-yellow-400 hover:text-yellow-300 text-xs font-medium"
                      @click="toggleGameStatus(game)"
                    >
                      {{ game.status === 'active' ? '停用' : '启用' }}
                    </button>
                    <button
                      v-if="!(game as any).is_deleted"
                      class="text-red-400 hover:text-red-300 text-xs font-medium"
                      @click="confirmDelete(game)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="romLoading && romList.length === 0">
                <td colspan="11" class="px-4 py-12 text-center text-gray-400">加载中...</td>
              </tr>
              <tr v-if="!romLoading && romList.length === 0">
                <td colspan="11" class="px-4 py-12 text-center text-gray-500">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-gray-400 text-sm">每页</span>
          <select v-model="romQuery.pageSize" class="input-field w-20" @change="fetchRoms">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span class="text-gray-400 text-sm">共 {{ romTotal }} 条</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            :disabled="romQuery.page <= 1"
            class="btn-secondary text-sm"
            @click="romQuery.page-- && fetchRoms()"
          >
            上一页
          </button>
          <template v-for="p in romPageNumbers" :key="p">
            <button
              v-if="p === '...'"
              disabled
              class="px-3 py-2 text-gray-500 text-sm"
            >
              ...
            </button>
            <button
              v-else
              :class="[
                'px-3 py-2 rounded text-sm font-medium transition-colors',
                romQuery.page === p
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              ]"
              @click="romQuery.page = p as number; fetchRoms()"
            >
              {{ p }}
            </button>
          </template>
          <button
            :disabled="romQuery.page >= romTotalPages"
            class="btn-secondary text-sm"
            @click="romQuery.page++ && fetchRoms()"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'logs'">
      <div class="card p-4 mb-6">
        <div class="flex flex-col lg:flex-row gap-3 flex-wrap">
          <select v-model="logQuery.action" class="input-field lg:w-48" @change="fetchAuditLogs">
            <option value="">全部操作</option>
            <option value="CREATE_ROM">上传</option>
            <option value="UPDATE_ROM">更新</option>
            <option value="DELETE_ROM">删除</option>
            <option value="TOGGLE_ROM_STATUS">切换状态</option>
            <option value="BATCH_DELETE_ROMS">批量删除</option>
          </select>
          <input
            v-model="logQuery.startDate"
            type="date"
            class="input-field lg:w-44"
            @change="fetchAuditLogs"
          />
          <input
            v-model="logQuery.endDate"
            type="date"
            class="input-field lg:w-44"
            @change="fetchAuditLogs"
          />
        </div>
      </div>

      <div class="card overflow-hidden mb-6">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-700 text-gray-400 text-left">
                <th class="px-4 py-3">时间</th>
                <th class="px-4 py-3">操作人</th>
                <th class="px-4 py-3">操作类型</th>
                <th class="px-4 py-3">目标类型</th>
                <th class="px-4 py-3">目标ID</th>
                <th class="px-4 py-3">详情</th>
                <th class="px-4 py-3">IP地址</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="log in auditLogs"
                :key="log.id"
                class="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
              >
                <td class="px-4 py-3 text-gray-400 whitespace-nowrap">{{ formatDate(log.created_at) }}</td>
                <td class="px-4 py-3 text-white">{{ log.operator_name }}</td>
                <td class="px-4 py-3">
                  <span :class="actionBadgeClass(log.action)">{{ actionLabel(log.action) }}</span>
                </td>
                <td class="px-4 py-3 text-gray-400">{{ log.target_type }}</td>
                <td class="px-4 py-3 text-gray-400 font-mono text-xs">{{ log.target_id || '-' }}</td>
                <td class="px-4 py-3 text-gray-400 max-w-xs truncate">{{ formatDetail(log.detail) }}</td>
                <td class="px-4 py-3 text-gray-400 font-mono text-xs">{{ log.ip_address || '-' }}</td>
              </tr>
              <tr v-if="logLoading && auditLogs.length === 0">
                <td colspan="7" class="px-4 py-12 text-center text-gray-400">加载中...</td>
              </tr>
              <tr v-if="!logLoading && auditLogs.length === 0">
                <td colspan="7" class="px-4 py-12 text-center text-gray-500">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-gray-400 text-sm">每页</span>
          <select v-model="logQuery.pageSize" class="input-field w-20" @change="fetchAuditLogs">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <span class="text-gray-400 text-sm">共 {{ logTotal }} 条</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            :disabled="logQuery.page <= 1"
            class="btn-secondary text-sm"
            @click="logQuery.page-- && fetchAuditLogs()"
          >
            上一页
          </button>
          <template v-for="p in logPageNumbers" :key="p">
            <button
              v-if="p === '...'"
              disabled
              class="px-3 py-2 text-gray-500 text-sm"
            >
              ...
            </button>
            <button
              v-else
              :class="[
                'px-3 py-2 rounded text-sm font-medium transition-colors',
                logQuery.page === p
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              ]"
              @click="logQuery.page = p as number; fetchAuditLogs()"
            >
              {{ p }}
            </button>
          </template>
          <button
            :disabled="logQuery.page >= logTotalPages"
            class="btn-secondary text-sm"
            @click="logQuery.page++ && fetchAuditLogs()"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <div v-if="showUploadModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="showUploadModal = false"></div>
      <div class="relative bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 class="text-xl font-bold text-white">上传 ROM</h2>
          <button @click="showUploadModal = false" class="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">平台 *</label>
            <select v-model="uploadForm.platform" class="input-field" @change="onUploadPlatformChange">
              <option value="">请选择平台</option>
              <option v-for="p in VALID_PLATFORMS" :key="p" :value="p">{{ PLATFORM_LABELS[p] }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">ROM文件 *</label>
            <input
              type="file"
              class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700 file:cursor-pointer"
              :accept="romAcceptExtensions"
              @change="onRomFileChange"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">封面图片</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-600 file:text-white hover:file:bg-gray-500 file:cursor-pointer"
              @change="onCoverFileChange"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">名称 *</label>
            <input v-model="uploadForm.name" type="text" class="input-field" placeholder="游戏名称" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">英文名</label>
            <input v-model="uploadForm.name_en" type="text" class="input-field" placeholder="English Name" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">模拟器核心</label>
            <input v-model="uploadForm.emulator_core" type="text" class="input-field" placeholder="自动填充" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">分类</label>
            <select v-model="uploadForm.category" class="input-field">
              <option value="">请选择分类</option>
              <option v-for="cat in GAME_CATEGORIES" :key="cat" :value="cat">{{ categoryLabel(cat) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">标签</label>
            <input v-model="uploadForm.tags" type="text" class="input-field" placeholder="逗号分隔，如：经典,动作" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">描述</label>
            <textarea v-model="uploadForm.description" class="input-field" rows="3" placeholder="游戏描述"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">发布年份</label>
              <input v-model.number="uploadForm.release_year" type="number" class="input-field" placeholder="1990" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">发行商</label>
              <input v-model="uploadForm.publisher" type="text" class="input-field" placeholder="发行商" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">版本号</label>
              <input v-model="uploadForm.version" type="text" class="input-field" placeholder="1.0" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">设备型号</label>
              <input v-model="uploadForm.device_model" type="text" class="input-field" placeholder="设备型号" />
            </div>
          </div>
          <div v-if="uploadProgress > 0 && uploadProgress < 100" class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div class="bg-primary-500 h-full rounded-full transition-all duration-300" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <div v-if="uploadProgress > 0 && uploadProgress < 100" class="text-sm text-gray-400 text-center">
            上传中 {{ uploadProgress }}%
          </div>
        </div>
        <div class="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button class="btn-secondary" @click="showUploadModal = false">取消</button>
          <button class="btn-primary" :disabled="uploading" @click="submitUpload">
            {{ uploading ? '上传中...' : '确认上传' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="showEditModal = false"></div>
      <div class="relative bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 class="text-xl font-bold text-white">编辑 ROM</h2>
          <button @click="showEditModal = false" class="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">名称 *</label>
            <input v-model="editForm.name" type="text" class="input-field" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">英文名</label>
            <input v-model="editForm.name_en" type="text" class="input-field" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">平台 *</label>
            <select v-model="editForm.platform" class="input-field" @change="onEditPlatformChange">
              <option v-for="p in VALID_PLATFORMS" :key="p" :value="p">{{ PLATFORM_LABELS[p] }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">模拟器核心</label>
            <input v-model="editForm.emulator_core" type="text" class="input-field" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">分类</label>
            <select v-model="editForm.category" class="input-field">
              <option value="">请选择分类</option>
              <option v-for="cat in GAME_CATEGORIES" :key="cat" :value="cat">{{ categoryLabel(cat) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">标签</label>
            <input v-model="editForm.tags" type="text" class="input-field" placeholder="逗号分隔" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">描述</label>
            <textarea v-model="editForm.description" class="input-field" rows="3"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">发布年份</label>
              <input v-model.number="editForm.release_year" type="number" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">发行商</label>
              <input v-model="editForm.publisher" type="text" class="input-field" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">版本号</label>
              <input v-model="editForm.version" type="text" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">设备型号</label>
              <input v-model="editForm.device_model" type="text" class="input-field" />
            </div>
          </div>
        </div>
        <div class="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button class="btn-secondary" @click="showEditModal = false">取消</button>
          <button class="btn-primary" :disabled="saving" @click="submitEdit">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showDeleteDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="showDeleteDialog = false"></div>
      <div class="relative bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md p-6">
        <h3 class="text-lg font-bold text-white mb-4">确认删除</h3>
        <p class="text-gray-300 mb-6">{{ deleteMessage }}</p>
        <div class="flex justify-end gap-3">
          <button class="btn-secondary" @click="showDeleteDialog = false">取消</button>
          <button class="btn-danger" :disabled="deleting" @click="executeDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>

    <div class="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm',
          toast.type === 'success' ? 'bg-green-600 text-white' : '',
          toast.type === 'error' ? 'bg-red-600 text-white' : '',
          toast.type === 'info' ? 'bg-primary-600 text-white' : ''
        ]"
      >
        {{ toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { adminApi } from '@/api/admin'
import type { AdminRomListQuery, AuditLogQuery, AuditLog } from '@/api/admin'
import {
  PLATFORM_LABELS,
  PLATFORM_CORE_MAP,
  GAME_CATEGORIES,
  VALID_PLATFORMS,
  PLATFORM_ROM_EXTENSIONS,
} from '@emu-matrix/shared'
import type { Game, Platform } from '@emu-matrix/shared'
import axios from 'axios'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

const tabs = [
  { key: 'roms', label: 'ROM 管理' },
  { key: 'logs', label: '操作日志' },
]

const activeTab = ref<'roms' | 'logs'>('roms')

const toasts = ref<Toast[]>([])
let toastId = 0

function showToast(message: string, type: Toast['type'] = 'info') {
  const id = ++toastId
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3000)
}

const romList = ref<Game[]>([])
const romTotal = ref(0)
const romTotalPages = ref(0)
const romLoading = ref(false)
const selectedIds = ref<string[]>([])

const romQuery = reactive<AdminRomListQuery & { page: number; pageSize: number }>({
  page: 1,
  pageSize: 20,
  search: '',
  platform: '',
  status: '',
  isDeleted: '',
  startDate: '',
  endDate: '',
})

const romPageNumbers = computed(() => {
  const total = romTotalPages.value
  const current = romQuery.page
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | string)[] = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  if (total > 1) pages.push(total)
  return pages
})

const isAllSelected = computed(() => {
  return romList.value.length > 0 && romList.value.every((g) => selectedIds.value.includes(g.id))
})

const isPartialSelected = computed(() => {
  const some = romList.value.some((g) => selectedIds.value.includes(g.id))
  return some && !isAllSelected.value
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = romList.value.map((g) => g.id)
  }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

function debounceFetchRoms() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    romQuery.page = 1
    fetchRoms()
  }, 300)
}

async function fetchRoms() {
  romLoading.value = true
  selectedIds.value = []
  try {
    const params: AdminRomListQuery = {
      page: romQuery.page,
      pageSize: romQuery.pageSize,
    }
    if (romQuery.search) params.search = romQuery.search
    if (romQuery.platform) params.platform = romQuery.platform
    if (romQuery.status) params.status = romQuery.status
    if (romQuery.isDeleted) params.isDeleted = romQuery.isDeleted
    if (romQuery.startDate) params.startDate = romQuery.startDate
    if (romQuery.endDate) params.endDate = romQuery.endDate

    const res = await adminApi.getRoms(params)
    if (res.success && res.data) {
      romList.value = res.data.items
      romTotal.value = res.data.total
      romTotalPages.value = res.data.totalPages
    }
  } catch {
    showToast('获取 ROM 列表失败', 'error')
  } finally {
    romLoading.value = false
  }
}

const showUploadModal = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadRomFile = ref<File | null>(null)
const uploadCoverFile = ref<File | null>(null)

const uploadForm = reactive({
  platform: '' as Platform | '',
  name: '',
  name_en: '',
  emulator_core: '',
  category: '',
  tags: '',
  description: '',
  release_year: '' as number | '',
  publisher: '',
  version: '',
  device_model: '',
})

const romAcceptExtensions = computed(() => {
  if (!uploadForm.platform) return '.nes,.md,.gen,.smd,.bin,.sfc,.smc,.gb,.gbc,.gba'
  const exts = PLATFORM_ROM_EXTENSIONS[uploadForm.platform as Platform]
  return exts.join(',')
})

function onUploadPlatformChange() {
  if (uploadForm.platform && PLATFORM_CORE_MAP[uploadForm.platform as Platform]) {
    uploadForm.emulator_core = PLATFORM_CORE_MAP[uploadForm.platform as Platform]
  } else {
    uploadForm.emulator_core = ''
  }
}

function onRomFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  uploadRomFile.value = target.files?.[0] || null
}

function onCoverFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  uploadCoverFile.value = target.files?.[0] || null
}

function openUploadModal() {
  Object.assign(uploadForm, {
    platform: '',
    name: '',
    name_en: '',
    emulator_core: '',
    category: '',
    tags: '',
    description: '',
    release_year: '',
    publisher: '',
    version: '',
    device_model: '',
  })
  uploadRomFile.value = null
  uploadCoverFile.value = null
  uploadProgress.value = 0
  showUploadModal.value = true
}

async function submitUpload() {
  if (!uploadForm.name) {
    showToast('请填写名称', 'error')
    return
  }
  if (!uploadForm.platform) {
    showToast('请选择平台', 'error')
    return
  }
  if (!uploadRomFile.value) {
    showToast('请选择 ROM 文件', 'error')
    return
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('rom', uploadRomFile.value)
    if (uploadCoverFile.value) formData.append('cover', uploadCoverFile.value)
    formData.append('name', uploadForm.name)
    if (uploadForm.name_en) formData.append('name_en', uploadForm.name_en)
    formData.append('platform', uploadForm.platform as string)
    if (uploadForm.emulator_core) formData.append('emulator_core', uploadForm.emulator_core)
    if (uploadForm.category) formData.append('category', uploadForm.category)
    if (uploadForm.tags) formData.append('tags', uploadForm.tags)
    if (uploadForm.description) formData.append('description', uploadForm.description)
    if (uploadForm.release_year) formData.append('release_year', String(uploadForm.release_year))
    if (uploadForm.publisher) formData.append('publisher', uploadForm.publisher)
    if (uploadForm.version) formData.append('version', uploadForm.version)
    if (uploadForm.device_model) formData.append('device_model', uploadForm.device_model)

    await axios.post('/api/admin/roms', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        }
      },
    })

    showToast('上传成功', 'success')
    showUploadModal.value = false
    fetchRoms()
  } catch (err: any) {
    const msg = err?.response?.data?.error || '上传失败'
    showToast(msg, 'error')
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

const showEditModal = ref(false)
const saving = ref(false)
const editingGameId = ref('')

const editForm = reactive({
  name: '',
  name_en: '',
  platform: '' as Platform,
  emulator_core: '',
  category: '',
  tags: '',
  description: '',
  release_year: '' as number | '',
  publisher: '',
  version: '',
  device_model: '',
})

function onEditPlatformChange() {
  if (editForm.platform && PLATFORM_CORE_MAP[editForm.platform]) {
    editForm.emulator_core = PLATFORM_CORE_MAP[editForm.platform]
  }
}

function openEditModal(game: Game) {
  editingGameId.value = game.id
  editForm.name = game.name
  editForm.name_en = game.name_en || ''
  editForm.platform = game.platform
  editForm.emulator_core = game.emulator_core || ''
  editForm.category = game.category || ''
  editForm.tags = Array.isArray(game.tags) ? game.tags.join(',') : (game.tags || '')
  editForm.description = game.description || ''
  editForm.release_year = game.release_year || ''
  editForm.publisher = game.publisher || ''
  editForm.version = (game as any).version || ''
  editForm.device_model = (game as any).device_model || ''
  showEditModal.value = true
}

async function submitEdit() {
  if (!editForm.name) {
    showToast('请填写名称', 'error')
    return
  }

  saving.value = true
  try {
    const body: Record<string, any> = {
      name: editForm.name,
      platform: editForm.platform,
    }
    if (editForm.name_en) body.name_en = editForm.name_en
    if (editForm.emulator_core) body.emulator_core = editForm.emulator_core
    if (editForm.category) body.category = editForm.category
    if (editForm.tags) body.tags = editForm.tags
    if (editForm.description) body.description = editForm.description
    if (editForm.release_year) body.release_year = editForm.release_year
    if (editForm.publisher) body.publisher = editForm.publisher
    if (editForm.version) body.version = editForm.version
    if (editForm.device_model) body.device_model = editForm.device_model

    await adminApi.updateRom(editingGameId.value, body)
    showToast('保存成功', 'success')
    showEditModal.value = false
    fetchRoms()
  } catch (err: any) {
    const msg = err?.response?.data?.error || '保存失败'
    showToast(msg, 'error')
  } finally {
    saving.value = false
  }
}

const showDeleteDialog = ref(false)
const deleting = ref(false)
const deleteMode = ref<'single' | 'batch'>('single')
const deleteTargetId = ref('')
const deleteMessage = ref('')

function confirmDelete(game: Game) {
  deleteMode.value = 'single'
  deleteTargetId.value = game.id
  deleteMessage.value = `确定要删除「${game.name}」吗？此操作为软删除。`
  showDeleteDialog.value = true
}

function confirmBatchDelete() {
  deleteMode.value = 'batch'
  deleteMessage.value = `确定要删除选中的 ${selectedIds.value.length} 个 ROM 吗？此操作为软删除。`
  showDeleteDialog.value = true
}

async function executeDelete() {
  deleting.value = true
  try {
    if (deleteMode.value === 'single') {
      await adminApi.deleteRom(deleteTargetId.value)
    } else {
      await adminApi.batchDelete(selectedIds.value)
    }
    showToast('删除成功', 'success')
    showDeleteDialog.value = false
    selectedIds.value = []
    fetchRoms()
  } catch (err: any) {
    const msg = err?.response?.data?.error || '删除失败'
    showToast(msg, 'error')
  } finally {
    deleting.value = false
  }
}

async function toggleGameStatus(game: Game) {
  const newStatus = game.status === 'active' ? 'inactive' : 'active'
  try {
    await adminApi.toggleStatus(game.id, newStatus)
    showToast(`${newStatus === 'active' ? '启用' : '停用'}成功`, 'success')
    fetchRoms()
  } catch (err: any) {
    const msg = err?.response?.data?.error || '操作失败'
    showToast(msg, 'error')
  }
}

const auditLogs = ref<AuditLog[]>([])
const logTotal = ref(0)
const logTotalPages = ref(0)
const logLoading = ref(false)

const logQuery = reactive<AuditLogQuery & { page: number; pageSize: number }>({
  page: 1,
  pageSize: 20,
  action: '',
  startDate: '',
  endDate: '',
})

const logPageNumbers = computed(() => {
  const total = logTotalPages.value
  const current = logQuery.page
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | string)[] = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  if (total > 1) pages.push(total)
  return pages
})

async function fetchAuditLogs() {
  logLoading.value = true
  try {
    const params: AuditLogQuery = {
      page: logQuery.page,
      pageSize: logQuery.pageSize,
    }
    if (logQuery.action) params.action = logQuery.action
    if (logQuery.startDate) params.startDate = logQuery.startDate
    if (logQuery.endDate) params.endDate = logQuery.endDate

    const res = await adminApi.getAuditLogs(params)
    if (res.success && res.data) {
      auditLogs.value = res.data.items
      logTotal.value = res.data.total
      logTotalPages.value = res.data.totalPages
    }
  } catch {
    showToast('获取日志失败', 'error')
  } finally {
    logLoading.value = false
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

function platformBadgeClass(platform: Platform): string {
  const map: Record<Platform, string> = {
    nes: 'platform-badge-nes',
    md: 'platform-badge-md',
    snes: 'platform-badge-snes',
    gb: 'platform-badge-gb',
    gba: 'platform-badge-gba',
  }
  return map[platform] || ''
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    action: '动作',
    shooting: '射击',
    rpg: '角色扮演',
    sports: '体育',
    strategy: '策略',
    puzzle: '益智',
    racing: '竞速',
    fighting: '格斗',
    platform: '平台',
    adventure: '冒险',
  }
  return map[cat] || cat
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    CREATE_ROM: '上传',
    UPDATE_ROM: '更新',
    DELETE_ROM: '删除',
    TOGGLE_ROM_STATUS: '切换状态',
    BATCH_DELETE_ROMS: '批量删除',
  }
  return map[action] || action
}

function actionBadgeClass(action: string): string {
  const map: Record<string, string> = {
    CREATE_ROM: 'bg-green-500/20 text-green-400',
    UPDATE_ROM: 'bg-blue-500/20 text-blue-400',
    DELETE_ROM: 'bg-red-500/20 text-red-400',
    TOGGLE_ROM_STATUS: 'bg-yellow-500/20 text-yellow-400',
    BATCH_DELETE_ROMS: 'bg-red-500/20 text-red-400',
  }
  return `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[action] || 'bg-gray-500/20 text-gray-400'}`
}

function formatDetail(detail: Record<string, unknown>): string {
  if (!detail) return '-'
  try {
    return JSON.stringify(detail)
  } catch {
    return '-'
  }
}

function handleCoverError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  const parent = img.parentElement
  if (parent) {
    const span = document.createElement('span')
    span.className = 'text-lg'
    span.textContent = '🎮'
    parent.appendChild(span)
  }
}

onMounted(() => {
  fetchRoms()
})
</script>
