import { djangoApi } from './api';

export const timelineService = {
  async list() {
    const response = await djangoApi.get('/timelines/');
    return response.data?.timelines || [];
  },

  async create(title, description) {
    const response = await djangoApi.post('/timelines/create/', {
      title,
      description,
    });
    return response.data;
  },

  async getDetail(timelineId) {
    const response = await djangoApi.get(`/timelines/${timelineId}/`);
    return response.data;
  },

  async update(timelineId, title, description) {
    const response = await djangoApi.put(`/timelines/${timelineId}/update/`, {
      title,
      description,
    });
    return response.data;
  },

  async delete(timelineId) {
    const response = await djangoApi.delete(`/timelines/${timelineId}/delete/`);
    return response.data;
  },
};
