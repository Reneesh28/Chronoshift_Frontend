import { fastapiApi } from './api';

export const simulationService = {
  async run({ timeline_id, branch_id, decision }) {
    const response = await fastapiApi.post('/simulate/run', {
      timeline_id,
      branch_id,
      decision,
    });
    return response.data;
  },

  async getStatus(simulationId) {
    const response = await fastapiApi.get(`/simulate/status/${simulationId}`);
    return response.data;
  },

  async getResult(simulationId) {
    const response = await fastapiApi.get(`/simulate/result/${simulationId}`);
    return response.data;
  },
};
