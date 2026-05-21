import { defineManifest } from '@crxjs/vite-plugin';

// host_permissions must be tightened to the production API domain before
// submitting to the Chrome Web Store. http://localhost:3000/* is for dev.
export default defineManifest({
  manifest_version: 3,
  name: 'StudySync',
  version: '1.0.0',
  description:
    'Generate study material from your courses, notes, and the page you are reading.',
  permissions: ['storage', 'activeTab', 'alarms'],
  host_permissions: ['http://localhost:3000/*'],
  externally_connectable: {
    matches: ['http://localhost:3000/*', 'https://*.vercel.app/*'],
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'StudySync',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/content.ts'],
      run_at: 'document_idle',
    },
  ],
});
