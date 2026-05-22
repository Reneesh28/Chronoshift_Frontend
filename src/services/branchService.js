import { djangoApi } from './api';

export const branchService = {
  async create({ timeline_id, parent_branch_id, branch_name, decision }) {
    const response = await djangoApi.post('/branches/create/', {
      timeline_id,
      parent_branch_id,
      branch_name,
      decision,
    });
    return response.data;
  },

  async getDetail(branchId) {
    const response = await djangoApi.get(`/branches/${branchId}/`);
    return response.data;
  },

  async injectDecision({ timeline_id, branch_id, event_type, decision }) {
    const response = await djangoApi.post('/events/', {
      timeline_id,
      branch_id,
      event_type,
      decision,
    });
    return response.data;
  },

  async compare({ timeline_id, branch_ids }) {
    const response = await djangoApi.post('/compare/', {
      timeline_id,
      branch_ids,
    });
    return response.data;
  },
};
