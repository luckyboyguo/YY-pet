// ClassPet Pro - Mobile App

document.addEventListener('DOMContentLoaded', () => {
    // 初始化数据管理器
    const dataManager = new DataManager();
    let currentStudent = null;

    // DOM元素
    const loginPage = document.getElementById('loginPage');
    const petPage = document.getElementById('petPage');
    const studentSelect = document.getElementById('studentSelect');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');

    // 填充学生列表
    function loadStudents() {
        dataManager.students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            studentSelect.appendChild(option);
        });

        // 更新班级名称
        document.querySelector('.class-name').textContent = dataManager.config.className || '二年级一班';
    }

    // 登录
    btnLogin.addEventListener('click', () => {
        const studentId = studentSelect.value;
        if (!studentId) {
            showAlert('请选择你的名字', '提示');
            return;
        }

        currentStudent = dataManager.getStudentById(studentId);
        if (!currentStudent) {
            showAlert('学生信息不存在', '错误');
            return;
        }

        showPetPage();
    });

    // 登出
    btnLogout.addEventListener('click', () => {
        currentStudent = null;
        showLoginPage();
    });

    // 显示宠物页面
    function showPetPage() {
        loginPage.classList.remove('active');
        petPage.classList.add('active');
        updatePetDisplay();
    }

    // 显示登录页面
    function showLoginPage() {
        petPage.classList.remove('active');
        loginPage.classList.add('active');
        studentSelect.value = '';
    }

    // 更新宠物显示
    function updatePetDisplay() {
        if (!currentStudent) return;

        const petInfo = getPetInfo(currentStudent);
        const petDisplay = getPetDisplay(currentStudent);

        // 更新学生信息
        document.getElementById('studentName').textContent = currentStudent.name;
        document.getElementById('studentScore').textContent = currentStudent.score;
        document.getElementById('petName').textContent = petInfo ? petInfo.name : '未认养';

        // 更新宠物显示
        const imageContainer = document.getElementById('petImageContainer');
        const petEmoji = document.getElementById('petEmoji');
        const petStage = document.getElementById('petStage');

        // 更新阶段
        if (petInfo) {
            petStage.textContent = petInfo.stageName;
            imageContainer.className = `pet-image-container ${petInfo.bgClass}`;
        } else {
            petStage.textContent = '蛋';
            imageContainer.className = 'pet-image-container stage-egg';
        }

        // 更新图片/emoji
        if (petDisplay.image) {
            petEmoji.innerHTML = `<img src="${petDisplay.image}" alt="宠物" class="pet-image-custom">`;
        } else {
            petEmoji.textContent = petDisplay.emoji;
        }

        // 更新按钮状态
        const btnAdopt = document.getElementById('btnAdopt');
        btnAdopt.style.display = petInfo ? 'none' : 'block';
    }

    // 获取宠物信息
    function getPetInfo(student) {
        if (!student.petId) return null;
        return dataManager.getPetById(student.petId);
    }

    // 获取宠物显示
    function getPetDisplay(student) {
        const petInfo = getPetInfo(student);

        if (!petInfo) {
            return { emoji: '🥚', image: null };
        }

        // 检查自定义图片
        if (student.customImage) {
            return { emoji: null, image: student.customImage };
        }

        // 根据积分计算阶段
        const stages = dataManager.config.stages;
        let currentStage = stages[0];

        for (let i = stages.length - 1; i >= 0; i--) {
            if (student.score >= stages[i].minScore) {
                currentStage = stages[i];
                break;
            }
        }

        return {
            emoji: petInfo.emoji,
            image: null,
            stage: currentStage
        };
    }

    // 认养宠物
    const btnAdopt = document.getElementById('btnAdopt');
    const adoptModal = document.getElementById('adoptModal');
    const closeAdopt = document.getElementById('closeAdopt');
    const petOptions = document.getElementById('petOptions');

    btnAdopt.addEventListener('click', () => {
        showAdoptModal();
    });

    closeAdopt.addEventListener('click', () => {
        adoptModal.classList.remove('active');
    });

    function showAdoptModal() {
        document.getElementById('adoptScore').textContent = currentStudent.score;
        petOptions.innerHTML = '';

        const allPets = dataManager.getAllPets();
        const petsByRarity = {
            common: allPets.filter(p => p.rarity === 'common'),
            rare: allPets.filter(p => p.rarity === 'rare'),
            epic: allPets.filter(p => p.rarity === 'epic'),
            legendary: allPets.filter(p => p.rarity === 'legendary')
        };

        const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
        const rarityNames = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
        const rarityCosts = { common: 5, rare: 20, epic: 50, legendary: 100 };

        rarityOrder.forEach(rarity => {
            petsByRarity[rarity].forEach(pet => {
                const option = document.createElement('div');
                option.className = 'pet-option';
                option.innerHTML = `
                    <div class="emoji">${pet.emoji}</div>
                    <div class="name">${pet.name}</div>
                    <div class="rarity rarity-${rarity}">${rarityNames[rarity]}</div>
                    <div class="cost">${rarityCosts[rarity]}分</div>
                `;

                option.addEventListener('click', () => {
                    if (currentStudent.score < rarityCosts[rarity]) {
                        showAlert(`积分不足！需要${rarityCosts[rarity]}分`, '提示');
                        return;
                    }

                    if (confirm(`确定认养${pet.name}吗？将消耗${rarityCosts[rarity]}分`)) {
                        currentStudent.petId = pet.id;
                        currentStudent.score -= rarityCosts[rarity];
                        dataManager.save();
                        updatePetDisplay();
                        adoptModal.classList.remove('active');
                        showAlert('认养成功！', '成功');
                    }
                });

                petOptions.appendChild(option);
            });
        });

        adoptModal.classList.add('active');
    }

    // 自定义形象
    const btnCustomize = document.getElementById('btnCustomize');
    const customizeModal = document.getElementById('customizeModal');
    const closeCustomize = document.getElementById('closeCustomize');
    const saveCustomImage = document.getElementById('saveCustomImage');
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');

    btnCustomize.addEventListener('click', () => {
        if (!currentStudent.petId) {
            showAlert('请先认养宠物', '提示');
            return;
        }
        customizeModal.classList.add('active');
    });

    closeCustomize.addEventListener('click', () => {
        customizeModal.classList.remove('active');
    });

    uploadArea.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'upload-preview';
                img.style.maxWidth = '200px';
                img.style.borderRadius = '12px';

                uploadArea.querySelector('.upload-placeholder').innerHTML = '';
                uploadArea.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });

    saveCustomImage.addEventListener('click', () => {
        const img = uploadArea.querySelector('.upload-preview');
        if (img) {
            currentStudent.customImage = img.src;
            dataManager.save();
            updatePetDisplay();
            customizeModal.classList.remove('active');
            showAlert('自定义形象已保存！', '成功');
        } else {
            showAlert('请先上传图片', '提示');
        }
    });

    // 兑换奖励
    const btnRedeem = document.getElementById('btnRedeem');
    const redeemModal = document.getElementById('redeemModal');
    const closeRedeem = document.getElementById('closeRedeem');
    const rewardList = document.getElementById('rewardList');

    btnRedeem.addEventListener('click', () => {
        showRedeemModal();
    });

    closeRedeem.addEventListener('click', () => {
        redeemModal.classList.remove('active');
    });

    function showRedeemModal() {
        document.getElementById('redeemScore').textContent = currentStudent.score;
        rewardList.innerHTML = '';

        dataManager.config.rewards.forEach(reward => {
            const item = document.createElement('div');
            item.className = 'reward-item';
            item.innerHTML = `
                <div class="reward-info">
                    <div class="reward-name">${reward.name}</div>
                    <div class="reward-cost">${reward.cost}分</div>
                    <div class="reward-stock">剩余: ${reward.stock}</div>
                </div>
                <button class="btn-redeem" ${currentStudent.score < reward.cost || reward.stock <= 0 ? 'disabled' : ''}>兑换</button>
            `;

            item.querySelector('.btn-redeem').addEventListener('click', () => {
                if (currentStudent.score < reward.cost) {
                    showAlert('积分不足！', '提示');
                    return;
                }
                if (reward.stock <= 0) {
                    showAlert('该奖励已兑换完毕！', '提示');
                    return;
                }

                if (confirm(`确定兑换${reward.name}吗？将消耗${reward.cost}分`)) {
                    currentStudent.score -= reward.cost;
                    reward.stock--;
                    dataManager.save();
                    updatePetDisplay();
                    redeemModal.classList.remove('active');
                    showAlert('兑换成功！', '成功');
                }
            });

            rewardList.appendChild(item);
        });

        redeemModal.classList.add('active');
    }

    // 提示弹窗
    const alertModal = document.getElementById('alertModal');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const closeAlert = document.getElementById('closeAlert');

    function showAlert(message, title = '提示') {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        alertModal.classList.add('active');
    }

    closeAlert.addEventListener('click', () => {
        alertModal.classList.remove('active');
    });

    // 初始化
    loadStudents();
});
