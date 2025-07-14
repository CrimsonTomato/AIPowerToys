import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    plugins: [
        createHtmlPlugin({
            inject: {
                // No global tags needed
            },
            pages: [
                {
                    filename: 'index.html',
                    template: 'index.html',
                    injectOptions: {
                        data: {
                            title: 'AI PowerToys',
                            injectLeftSidebar: fs.readFileSync(
                                path.resolve(
                                    __dirname,
                                    './public/components/left_sidebar.html'
                                ),
                                'utf-8'
                            ),
                            // --- REMOVED: The workbench is now loaded dynamically by main.js/ui.js ---
                            // injectCenterStage: fs.readFileSync(...)
                        },
                    },
                },
            ],
        }),
    ],
});
