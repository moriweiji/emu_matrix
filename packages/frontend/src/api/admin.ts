import apiClient from './client'
import type { ApiResponse, PaginatedResponse, Game } from '@emu-matrix/shared'

export interface AdminRomListQuery {
  page?: number
  pageSize?: number
  search?: string
  platform?: string
  status?: string
  isDeleted?: string
  startDate?: string
  endDate?: string
}

export interface AdminRomFormData {
  name: string
  name_en?: string
  platform: string
  emulator_core?: string
  category?: string
  tags?: string
  description?: string
  release_year?: number | string
  publisher?: string
  version?: string
  device_model?: string
}

export interface AuditLogQuery {
  page?: number
  pageSize?: number
  action?: string
  targetType?: string
  operatorId?: string
  startDate?: string
  endDate?: string
}

export interface AuditLog {
  id: string
  operator_id: string
  operator_name: string
  action: string
  target_type: string
  target_id: string
  detail: Record<string, unknown>
  ip_address: string
  created_at: string
}

export const adminApi = {
  async getRoms(params: AdminRomListQuery): Promise<ApiResponse<PaginatedResponse<Game>>> {
    const { data } = await apiClient.get('/admin/roms', { params })
    return data
  },

  async getRom(id: string): Promise<ApiResponse<Game>> {
    const { data } = await apiClient.get(`/admin/roms/${id}`)
    return data
  },

  async createRom(formData: FormData): Promise<ApiResponse<Game>> {
    const { data } = await apiClient.post('/admin/roms', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
    return data
  },

  async updateRom(id: string, body: Partial<Game>): Promise<ApiResponse<Game>> {
    const { data } = await apiClient.put(`/admin/roms/${id}`, body)
    return data
  },

  async toggleStatus(id: string, status: string): Promise<ApiResponse<Game>> {
    const { data } = await apiClient.patch(`/admin/roms/${id}/status`, { status })
    return data
  },

  async deleteRom(id: string): Promise<ApiResponse<null>> {
    const { data } = await apiClient.delete(`/admin/roms/${id}`)
    return data
  },

  async batchDelete(ids: string[]): Promise<ApiResponse<null>> {
    const { data } = await apiClient.post('/admin/roms/batch-delete', { ids })
    return data
  },

  async getAuditLogs(params: AuditLogQuery): Promise<ApiResponse<PaginatedResponse<AuditLog>>> {
    const { data } = await apiClient.get('/admin/audit-logs', { params })
    return data
  },
}
