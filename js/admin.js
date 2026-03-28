// ClassPet Pro - 手机管理端

// ==================== 数据管理 =====================
const PRESET_FEISHU_SYNC_CONFIG = {
    appToken: '',
    tableId: '',
    appId: '',
    appSecret: '',
    accessToken: '',
    proxyBasePath: '/api/feishu',
    preferProxy: true,
    useCloudSync: false,
    syncInterval: 30
};
const FEISHU_CONFIG_RESET_VERSION = '2026-03-28-reset-v1';

// ==================== 飞书同步管理 =====================
class FeishuConfigManager {
    constructor(dataManager) {
        this.data = dataManager;
        this.sync = new FeishuBitableSync();
        this.autoSync = new FeishuAutoSyncManager(this.sync);
        this.loadConfig();
    }

    // 规范化同步间隔（秒）
    normalizeSyncIntervalSeconds(syncIntervalSeconds) {
        const parsed = parseInt(syncIntervalSeconds, 10);
        if (Number.isNaN(parsed)) return 30;
        return Math.min(300, Math.max(10, parsed));
    }

    // 加载飞书配置
    loadConfig() {
        // 一次性重置历史飞书配置，避免继续使用旧凭据
        const resetVersion = localStorage.getItem('classpet_feishu_reset_version');
        if (resetVersion !== FEISHU_CONFIG_RESET_VERSION) {
            localStorage.setItem('classpet_feishu_config', JSON.stringify({
                ...PRESET_FEISHU_SYNC_CONFIG
            }));
            localStorage.setItem('classpet_feishu_reset_version', FEISHU_CONFIG_RESET_VERSION);
        }

        const configText = localStorage.getItem('classpet_feishu_config');
        if (!configText) {
            this.sync.init(PRESET_FEISHU_SYNC_CONFIG);
            const syncIntervalSeconds = this.normalizeSyncIntervalSeconds(PRESET_FEISHU_SYNC_CONFIG.syncInterval);
            this.autoSync.setSyncInterval(syncIntervalSeconds * 1000);
            if (this.sync.isConfigured && this.sync.useCloudSync) {
                this.autoSync.start();
            }
            return;
        }

        try {
            const config = {
                ...PRESET_FEISHU_SYNC_CONFIG,
                ...JSON.parse(configText)
            };
            const syncIntervalSeconds = this.normalizeSyncIntervalSeconds(config.syncInterval);

            this.sync.init(config);
            this.autoSync.setSyncInterval(syncIntervalSeconds * 1000);

            // 管理端重开后自动恢复云同步
            if (this.sync.isConfigured && this.sync.useCloudSync) {
                this.autoSync.start();
            }
        } catch (error) {
            console.error('飞书配置加载失败:', error);
        }
    }

    // 保存飞书配置
    saveConfig(config) {
        const normalizedConfig = {
            ...config,
            syncInterval: this.normalizeSyncIntervalSeconds(config.syncInterval)
        };

        localStorage.setItem('classpet_feishu_config', JSON.stringify(normalizedConfig));
        this.sync.init(normalizedConfig);
    }

    // 启动自动同步
    startAutoSync(syncIntervalSeconds = null) {
        if (this.sync.isConfigured && this.sync.useCloudSync) {
            if (syncIntervalSeconds !== null && syncIntervalSeconds !== undefined) {
                const normalizedSeconds = this.normalizeSyncIntervalSeconds(syncIntervalSeconds);
                this.autoSync.setSyncInterval(normalizedSeconds * 1000);
            }
            this.autoSync.start();
            return true;
        }
        return false;
    }

    // 停止自动同步
    stopAutoSync() {
        this.autoSync.stop();
    }

    // 测试连接
    async testConnection() {
        return await this.sync.checkConnection();
    }

    // 创建表格
    async createTable() {
        return await this.sync.createTableIfNotExists();
    }

    // 手动同步
    async forceSync() {
        return await this.autoSync.forceSync();
    }

    // 获取同步状态
    getSyncStatus() {
        return this.autoSync.getStatus();
    }
}

// ==================== UI管理 ====================
class AdminUI {
    constructor(dataManager) {
        this.data = dataManager;
        this.feishuManager = new FeishuConfigManager(dataManager);
        this.selectedStudents = new Set();
        this.currentEditId = null;
        this.editingRewards = [];
        this.init();
    }

    init() {
        this.renderStudentList();
        this.bindEvents();
        this.updateHeaderInfo();
        this.initFeishuConfig();
    }

    updateHeaderInfo() {
        document.querySelector('.class-name').textContent = this.data.config.className || '三年级一班';
        document.querySelector('.student-count').textContent = `${this.data.students.length}人`;
    }

    renderStudentList(searchTerm = '') {
        const list = document.getElementById('studentList');
        const filtered = this.data.students.filter(s => 
            s.name.includes(searchTerm)
        );

        list.innerHTML = filtered.map(student => {
            const stage = this.data.getStage(student.score);
            return `
                <div class="student-item" data-id="${student.id}">
                    <div class="student-avatar ${stage.bgClass}">${stage.emoji}</div>
                    <div class="student-info">
                        <div class="student-name">${student.name}</div>
                        <div class="student-meta">${student.rewards.length}个奖励</div>
                    </div>
                    <div class="student-score">
                        <div class="score-value">${student.score}</div>
                        <div class="stage-tag ${stage.bgClass}">${stage.name}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 绑定点击事件
        list.querySelectorAll('.student-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                this.openEditModal(id);
            });
        });
    }

    bindEvents() {
        // 搜索
        document.getElementById('searchStudent').addEventListener('input', (e) => {
            this.renderStudentList(e.target.value);
        });

        // 快捷操作
        document.getElementById('btnAddScore').addEventListener('click', () => {
            this.openBatchModal();
        });

        document.getElementById('btnSettings').addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.getElementById('btnExport').addEventListener('click', () => {
            this.openExportModal();
        });

        document.getElementById('btnAddStudent').addEventListener('click', () => {
            this.openAddStudentModal();
        });

        // 关闭弹窗
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.classList.remove('active');
            });
        });
        ['btnCancelEdit', 'btnCancelBatch', 'btnCancelSettings'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) modal.classList.remove('active');
            });
        });

        // 编辑学生
        document.getElementById('btnSaveStudent').addEventListener('click', () => {
            this.saveStudentEdit();
        });

        document.getElementById('btnDeleteStudent').addEventListener('click', () => {
            this.deleteStudent();
        });

        // 批量加分
        document.getElementById('btnConfirmBatch').addEventListener('click', () => {
            this.confirmBatchScore();
        });

        document.getElementById('selectAll').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.batch-student-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const id = parseInt(cb.dataset.id);
                if (e.target.checked) {
                    this.selectedStudents.add(id);
                } else {
                    this.selectedStudents.delete(id);
                }
            });
        });

        // 分数预设按钮
        document.querySelectorAll('.btn-score-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-score-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('batchScoreValue').value = btn.dataset.value;
            });
        });

        // 设置标签页
        document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.settings-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.querySelector(`.tab-panel[data-panel="${tab}"]`).classList.add('active');
            });
        });

        // 保存设置
        document.getElementById('btnSaveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        // 奖励设置增删改
        document.getElementById('btnAddReward').addEventListener('click', () => {
            this.addRewardSetting();
        });

        document.getElementById('rewardsList').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-reward');
            if (!deleteBtn) return;
            const index = parseInt(deleteBtn.dataset.index, 10);
            this.deleteRewardSetting(index);
        });

        // 导出
        document.getElementById('exportExcel').addEventListener('click', () => {
            this.exportExcel();
        });

        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportJSON();
        });

        document.getElementById('shareData').addEventListener('click', () => {
            this.shareData();
        });
    }

    openEditModal(studentId) {
        this.currentEditId = studentId;
        const student = this.data.getStudent(studentId);
        if (!student) return;

        const stage = this.data.getStage(student.score);
        
        document.getElementById('editModalTitle').textContent = '编辑成员';
        document.getElementById('editName').value = student.name;
        document.getElementById('editScore').value = student.score;
        document.getElementById('editStage').textContent = stage.emoji + ' ' + stage.name;

        document.getElementById('studentEditModal').classList.add('active');
    }

    openAddStudentModal() {
        this.currentEditId = null;
        document.getElementById('editModalTitle').textContent = '添加成员';
        document.getElementById('editName').value = '';
        document.getElementById('editScore').value = '0';
        document.getElementById('editStage').textContent = '🥚 蛋';
        document.getElementById('studentEditModal').classList.add('active');
    }

    saveStudentEdit() {
        const name = document.getElementById('editName').value.trim();
        const score = parseInt(document.getElementById('editScore').value) || 0;

        if (!name) {
            this.showToast('请输入成员姓名');
            return;
        }

        if (this.currentEditId) {
            this.data.updateStudent(this.currentEditId, { name, score });
            this.showToast('更新成功');
        } else {
            this.data.addStudent(name);
            this.data.updateStudent(this.data.students[this.data.students.length - 1].id, { score });
            this.showToast('添加成功');
        }

        this.renderStudentList();
        this.updateHeaderInfo();
        document.getElementById('studentEditModal').classList.remove('active');
    }

    deleteStudent() {
        if (!this.currentEditId) return;
        
        if (confirm('确定删除这个成员吗？')) {
            this.data.deleteStudent(this.currentEditId);
            this.renderStudentList();
            this.updateHeaderInfo();
            document.getElementById('studentEditModal').classList.remove('active');
            this.showToast('删除成功');
        }
    }

    openBatchModal() {
        this.selectedStudents.clear();
        const list = document.getElementById('batchStudentList');
        
        list.innerHTML = this.data.students.map(student => {
            const stage = this.data.getStage(student.score);
            return `
                <div class="select-item">
                    <input type="checkbox" class="batch-student-checkbox" data-id="${student.id}">
                    <span>${student.name}</span>
                    <span style="margin-left: auto; color: #999;">${stage.name} ${student.score}分</span>
                </div>
            `;
        }).join('');

        // 绑定复选框事件
        list.querySelectorAll('.batch-student-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) {
                    this.selectedStudents.add(id);
                } else {
                    this.selectedStudents.delete(id);
                }
            });
        });

        document.getElementById('batchScoreModal').classList.add('active');
    }

    confirmBatchScore() {
        const scoreInput = document.getElementById('batchScoreValue');
        const delta = parseInt(scoreInput.value) || 0;

        if (this.selectedStudents.size === 0) {
            this.showToast('请选择成员');
            return;
        }

        if (delta === 0) {
            this.showToast('请输入分数');
            return;
        }

        let count = 0;
        this.selectedStudents.forEach(id => {
            if (this.data.updateScore(id, delta)) {
                count++;
            }
        });

        this.showToast(`已为${count}名成员${delta > 0 ? '加分' : '扣分'}${Math.abs(delta)}分`);
        this.renderStudentList();
        document.getElementById('batchScoreModal').classList.remove('active');
        document.getElementById('selectAll').checked = false;
        scoreInput.value = '';
        document.querySelectorAll('.btn-score-preset').forEach(b => b.classList.remove('active'));
    }

    openSettingsModal() {
        // 加载当前设置
        document.getElementById('settingClassName').value = this.data.config.className || '三年级一班';
        document.getElementById('settingPassword').value = this.data.config.teacherPassword || '1234';

        // 渲染阶段设置
        const stagesList = document.getElementById('stagesList');
        stagesList.innerHTML = this.data.config.stages.map((stage, index) => `
            <div class="stage-setting-item">
                <span class="stage-emoji">${stage.emoji}</span>
                <div class="stage-info">
                    <div class="stage-name">${stage.name}</div>
                    <div class="stage-threshold">升级阈值</div>
                </div>
                <input type="number" value="${stage.minScore}" data-index="${index}" class="stage-threshold-input">
            </div>
        `).join('');

        // 渲染奖励设置（可增删改查）
        this.editingRewards = (this.data.config.rewards || []).map((reward, index) => ({
            id: reward.id || Date.now() + index,
            name: reward.name || '',
            cost: Number(reward.cost) || 0,
            stock: Number.isFinite(Number(reward.stock)) ? Number(reward.stock) : 1
        }));
        this.renderRewardSettings();

        document.getElementById('settingsModal').classList.add('active');
    }

    renderRewardSettings() {
        const rewardsList = document.getElementById('rewardsList');
        rewardsList.innerHTML = this.editingRewards.map((reward, index) => `
            <div class="reward-setting-item" data-index="${index}">
                <div class="reward-input-group">
                    <label>奖励名称</label>
                    <input type="text" class="reward-name-input" data-index="${index}" value="${reward.name}" placeholder="例如：电影之夜">
                </div>
                <div class="reward-input-group reward-number-group">
                    <label>所需积分</label>
                    <input type="number" class="reward-cost-input" data-index="${index}" value="${reward.cost}" min="0">
                </div>
                <div class="reward-input-group reward-number-group">
                    <label>库存</label>
                    <input type="number" class="reward-stock-input" data-index="${index}" value="${reward.stock}" min="0">
                </div>
                <button class="btn-secondary btn-delete-reward" data-index="${index}">删除</button>
            </div>
        `).join('');
    }

    syncRewardInputsToState() {
        const rewardItems = document.querySelectorAll('.reward-setting-item');
        this.editingRewards = Array.from(rewardItems).map((item, index) => {
            const nameInput = item.querySelector('.reward-name-input');
            const costInput = item.querySelector('.reward-cost-input');
            const stockInput = item.querySelector('.reward-stock-input');
            const fallback = this.editingRewards[index] || {};
            return {
                id: fallback.id || Date.now() + index,
                name: (nameInput?.value || '').trim(),
                cost: parseInt(costInput?.value, 10) || 0,
                stock: parseInt(stockInput?.value, 10) || 0
            };
        });
    }

    addRewardSetting() {
        this.syncRewardInputsToState();
        this.editingRewards.push({
            id: Date.now(),
            name: '',
            cost: 100,
            stock: 1
        });
        this.renderRewardSettings();
    }

    deleteRewardSetting(index) {
        this.syncRewardInputsToState();
        if (index < 0 || index >= this.editingRewards.length) return;
        this.editingRewards.splice(index, 1);
        this.renderRewardSettings();
    }

    saveSettings() {
        // 基础设置
        this.data.config.className = document.getElementById('settingClassName').value;
        this.data.config.teacherPassword = document.getElementById('settingPassword').value;

        // 阶段阈值
        document.querySelectorAll('.stage-threshold-input').forEach(input => {
            const index = parseInt(input.dataset.index);
            this.data.config.stages[index].minScore = parseInt(input.value) || 0;
        });

        // 奖励设置（增删改查结果保存）
        this.syncRewardInputsToState();
        const normalizedRewards = this.editingRewards
            .map((reward, index) => ({
                id: reward.id || Date.now() + index,
                name: (reward.name || '').trim(),
                cost: Math.max(0, parseInt(reward.cost, 10) || 0),
                stock: Math.max(0, parseInt(reward.stock, 10) || 0)
            }))
            .filter(reward => reward.name);

        if (normalizedRewards.length === 0) {
            this.showToast('请至少保留一个奖励');
            return;
        }
        this.data.config.rewards = normalizedRewards;

        // 飞书配置
        const useCloudSync = document.getElementById('enableCloudSync').checked;
        const syncInterval = parseInt(document.getElementById('syncInterval').value) || 30;

        const feishuConfig = {
            appToken: document.getElementById('feishuAppToken').value.trim(),
            tableId: document.getElementById('feishuTableId').value.trim(),
            appId: document.getElementById('feishuAppId').value.trim(),
            appSecret: document.getElementById('feishuAppSecret').value.trim(),
            accessToken: document.getElementById('feishuAccessToken').value.trim(),
            accessTokenExpireAt: this.feishuManager.sync.accessTokenExpireAt || 0,
            proxyBasePath: PRESET_FEISHU_SYNC_CONFIG.proxyBasePath,
            preferProxy: PRESET_FEISHU_SYNC_CONFIG.preferProxy,
            useCloudSync: useCloudSync,
            syncInterval: syncInterval
        };

        // 保存飞书配置
        this.feishuManager.saveConfig(feishuConfig);

        // 启动或停止自动同步
        const hasTokenAuth = !!feishuConfig.accessToken;
        const hasAppCredentialAuth = !!(feishuConfig.appId && feishuConfig.appSecret);
        if (useCloudSync && feishuConfig.appToken && feishuConfig.tableId && (hasTokenAuth || hasAppCredentialAuth)) {
            this.feishuManager.startAutoSync(syncInterval);
            this.showToast('云端同步已启用');
        } else {
            this.feishuManager.stopAutoSync();
            this.showToast(useCloudSync ? '云端同步未完整配置（缺少鉴权）' : '云端同步已关闭');
        }

        this.data.saveConfig();
        this.updateHeaderInfo();
        document.getElementById('settingsModal').classList.remove('active');
        this.showToast('设置已保存');

        // 同时更新主页面的班级名称（如果主页打开）
        try {
            if (window.opener && window.opener.location.pathname.includes('index.html')) {
                window.opener.postMessage({ type: 'updateClassName', className: this.data.config.className }, '*');
            }
        } catch (e) {
            // 跨域或其他错误，忽略
        }
    }

    openExportModal() {
        document.getElementById('exportModal').classList.add('active');
    }

    exportExcel() {
        const csv = this.data.exportToCSV();
        this.downloadFile(csv, 'classpet_data.csv', 'text/csv');
        document.getElementById('exportModal').classList.remove('active');
        this.showToast('Excel已导出');
    }

    exportJSON() {
        const json = this.data.exportToJSON();
        this.downloadFile(json, 'classpet_backup.json', 'application/json');
        document.getElementById('exportModal').classList.remove('active');
        this.showToast('JSON已导出');
    }

    shareData() {
        const json = this.data.exportToJSON();
        if (navigator.share) {
            navigator.share({
                title: 'ClassPet数据',
                text: json
            });
        } else {
            navigator.clipboard.writeText(json);
            this.showToast('数据已复制到剪贴板');
        }
        document.getElementById('exportModal').classList.remove('active');
    }

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // 初始化飞书配置界面
    initFeishuConfig() {
        const enableCheckbox = document.getElementById('enableCloudSync');
        const configSection = document.getElementById('feishuConfigSection');

        // 加载预置配置 + 已保存配置
        let config = { ...PRESET_FEISHU_SYNC_CONFIG };
        const savedConfig = localStorage.getItem('classpet_feishu_config');
        if (savedConfig) {
            try {
                config = {
                    ...config,
                    ...JSON.parse(savedConfig)
                };
            } catch (error) {
                console.error('读取飞书配置失败:', error);
            }
        }

        enableCheckbox.checked = (config.useCloudSync ?? PRESET_FEISHU_SYNC_CONFIG.useCloudSync) || false;
        document.getElementById('feishuAppToken').value = config.appToken || PRESET_FEISHU_SYNC_CONFIG.appToken || '';
        document.getElementById('feishuTableId').value = config.tableId || PRESET_FEISHU_SYNC_CONFIG.tableId || '';
        document.getElementById('feishuAppId').value = config.appId || PRESET_FEISHU_SYNC_CONFIG.appId || '';
        document.getElementById('feishuAppSecret').value = config.appSecret || PRESET_FEISHU_SYNC_CONFIG.appSecret || '';
        document.getElementById('feishuAccessToken').value = config.accessToken || PRESET_FEISHU_SYNC_CONFIG.accessToken || '';
        document.getElementById('syncInterval').value = config.syncInterval || PRESET_FEISHU_SYNC_CONFIG.syncInterval || 30;

        if (enableCheckbox.checked) {
            configSection.style.display = 'block';
        }

        // 监听启用/禁用复选框
        enableCheckbox.addEventListener('change', (e) => {
            configSection.style.display = e.target.checked ? 'block' : 'none';
        });

        // 测试连接
        document.getElementById('btnTestConnection').addEventListener('click', async (e) => {
            e.preventDefault();
            const statusDiv = document.getElementById('connectionStatus');
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#fff3cd';
            statusDiv.style.color = '#856404';
            statusDiv.textContent = '正在测试连接...';

            // 临时加载配置
            const tempConfig = {
                appToken: document.getElementById('feishuAppToken').value.trim(),
                tableId: document.getElementById('feishuTableId').value.trim(),
                appId: document.getElementById('feishuAppId').value.trim(),
                appSecret: document.getElementById('feishuAppSecret').value.trim(),
                accessToken: document.getElementById('feishuAccessToken').value.trim(),
                accessTokenExpireAt: this.feishuManager.sync.accessTokenExpireAt || 0,
                proxyBasePath: PRESET_FEISHU_SYNC_CONFIG.proxyBasePath,
                preferProxy: PRESET_FEISHU_SYNC_CONFIG.preferProxy,
                useCloudSync: true
            };

            this.feishuManager.sync.init(tempConfig);
            const result = await this.feishuManager.testConnection();

            if (result) {
                statusDiv.style.background = '#d4edda';
                statusDiv.style.color = '#155724';
                statusDiv.textContent = '✅ 连接成功！飞书Bitable已连接';
            } else {
                statusDiv.style.background = '#f8d7da';
                statusDiv.style.color = '#721c24';
                const errorMsg = this.feishuManager.sync.lastError || '连接失败，请检查配置参数';
                statusDiv.textContent = `❌ ${errorMsg}`;
            }
        });

        // 创建表格
        document.getElementById('btnCreateTable').addEventListener('click', async (e) => {
            e.preventDefault();
            const statusDiv = document.getElementById('connectionStatus');
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#fff3cd';
            statusDiv.style.color = '#856404';
            statusDiv.textContent = '正在创建表格...';

            const tempConfig = {
                appToken: document.getElementById('feishuAppToken').value.trim(),
                tableId: document.getElementById('feishuTableId').value.trim(),
                appId: document.getElementById('feishuAppId').value.trim(),
                appSecret: document.getElementById('feishuAppSecret').value.trim(),
                accessToken: document.getElementById('feishuAccessToken').value.trim(),
                accessTokenExpireAt: this.feishuManager.sync.accessTokenExpireAt || 0,
                proxyBasePath: PRESET_FEISHU_SYNC_CONFIG.proxyBasePath,
                preferProxy: PRESET_FEISHU_SYNC_CONFIG.preferProxy,
                useCloudSync: true
            };

            this.feishuManager.sync.init(tempConfig);
            const result = await this.feishuManager.createTable();

            if (result) {
                statusDiv.style.background = '#d4edda';
                statusDiv.style.color = '#155724';
                statusDiv.textContent = '✅ 数据表已就绪（可直接同步）';
            } else {
                statusDiv.style.background = '#f8d7da';
                statusDiv.style.color = '#721c24';
                const errorMsg = this.feishuManager.sync.lastError || '表格创建失败，请检查权限和配置';
                statusDiv.textContent = `❌ ${errorMsg}`;
            }
        });

        this.tryAutoFillAccessToken();
    }

    async tryAutoFillAccessToken() {
        const appToken = document.getElementById('feishuAppToken').value.trim();
        const tableId = document.getElementById('feishuTableId').value.trim();
        const appId = document.getElementById('feishuAppId').value.trim();
        const appSecret = document.getElementById('feishuAppSecret').value.trim();
        const accessTokenInput = document.getElementById('feishuAccessToken');
        const accessToken = accessTokenInput.value.trim();

        if (!appToken || !tableId || !appId || !appSecret || accessToken) {
            return;
        }

        const tempConfig = {
            appToken,
            tableId,
            appId,
            appSecret,
            proxyBasePath: PRESET_FEISHU_SYNC_CONFIG.proxyBasePath,
            preferProxy: PRESET_FEISHU_SYNC_CONFIG.preferProxy,
            useCloudSync: true
        };
        this.feishuManager.sync.init(tempConfig);
        const token = await this.feishuManager.sync.getAccessToken(true);
        if (token) {
            accessTokenInput.value = token;
            this.showToast('已自动获取访问令牌');
        }
    }
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    const adminUI = new AdminUI(dataManager);

    window.AdminApp = {
        data: dataManager,
        ui: adminUI
    };

    console.log('ClassPet Pro 管理端已加载！');
});
