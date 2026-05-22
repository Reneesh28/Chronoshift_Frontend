import { flaskApi } from './api';

export const aiService = {
  async generateSummary({ timeline_id, branch_id, simulation_id }) {
    const response = await flaskApi.post('/ai/generate-summary', {
      timeline_id,
      branch_id,
      simulation_id,
    });
    return response.data;
  },

  async getSummary(summaryId) {
    const response = await flaskApi.get(`/ai/summary/${summaryId}`);
    return response.data;
  },

  async getSummaryByBranch(branchId) {
    const response = await flaskApi.get(`/ai/summary/branch/${branchId}`);
    return response.data;
  },
};
