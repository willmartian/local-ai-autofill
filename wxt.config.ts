import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Local AI Autofill',
    description: 'Autofill forms using Chrome built-in AI',
    permissions: ['activeTab'],
  },
});
