import { djangoApi } from './api';

export const replayService = {
  async start({ timeline_id, branch_id }) {
    const response = await djangoApi.post('/replay/start/', {
      timeline_id,
      branch_id,
    });
    return response.data;
  },

  async getStatus(replayId) {
    const response = await djangoApi.get(`/replay/status/${replayId}/`);
    return response.data;
  },

  async getDetails(replayId) {
    const response = await djangoApi.get(`/replay/details/${replayId}/`);
    return response.data;
  },
};
