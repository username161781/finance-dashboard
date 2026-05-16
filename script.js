// ============================================
// КЛАСС ДЛЯ ТРАНЗАКЦИИ (Модель)
// ============================================
class Transaction {
    constructor(amount, category, description, date, type) {
        this.id = Date.now() + Math.random();
        this.amount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
        this.category = this._formatCategory(category, type);
        this.description = description;
        this.date = date;
        this.status = "Успешно";
        this.type = type;
    }

    _formatCategory(category, type) {
        if (type === 'expense' && category === 'food') {
            return 'Еда и здоровье';
        }
        if (category === 'salary') return 'Зарплата';
        if (category === 'freelance') return 'Фриланс';
        if (category === 'business') return 'Бизнес';
        if (category === 'investment') return 'Инвестиции';
        if (category === 'entertainment') return 'Развлечения';
        if (category === 'shopping') return 'Покупки';
        if (category === 'transport') return 'Транспорт';
        if (category === 'utilities') return 'Коммунальные услуги';
        if (category === 'other') return 'Другое';
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    isIncome() {
        return this.amount > 0;
    }

    getAbsoluteAmount() {
        return Math.abs(this.amount);
    }

    toJSON() {
        return {
            id: this.id,
            amount: this.amount,
            category: this.category,
            description: this.description,
            date: this.date,
            status: this.status,
            type: this.type
        };
    }

    static fromJSON(data) {
        let category = data.category;
        if (category === 'Food & Health') category = 'Еда и здоровье';
        if (category === 'Salary') category = 'Зарплата';
        if (category === 'Freelance') category = 'Фриланс';
        if (category === 'Business') category = 'Бизнес';
        if (category === 'Investment') category = 'Инвестиции';
        if (category === 'Entertainment') category = 'Развлечения';
        if (category === 'Shopping') category = 'Покупки';
        if (category === 'Transport') category = 'Транспорт';
        if (category === 'Utilities') category = 'Коммунальные услуги';
        if (category === 'Other') category = 'Другое';
        
        const t = new Transaction(
            Math.abs(data.amount),
            category === 'Еда и здоровье' ? 'food' : category.toLowerCase(),
            data.description,
            data.date,
            data.amount > 0 ? 'income' : 'expense'
        );
        t.id = data.id;
        t.status = data.status;
        return t;
    }
}

// ============================================
// КЛАСС ДЛЯ РАБОТЫ С ХРАНИЛИЩЕМ
// ============================================
class StorageService {
    constructor(storageKey = 'finance_transactions') {
        this.storageKey = storageKey;
        this.apiEndpoint = 'https://api.jsonbin.io/v3/b/';
    }

    loadTransactions() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            const data = JSON.parse(saved);
            return data.map(t => Transaction.fromJSON(t));
        }
        return [];
    }

    saveTransactions(transactions) {
        const data = transactions.map(t => t.toJSON());
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        this._syncToCloud(data).catch(console.warn);
    }

    async _syncToCloud(data) {
        try {
            const response = await fetch(this.apiEndpoint + 'YOUR_BIN_ID', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': '$2a$10$YOUR_API_KEY'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Cloud sync failed');
            }
            
            console.log('Data synced to cloud successfully');
        } catch (error) {
            console.error('Cloud sync error:', error);
        }
    }

    clearStorage() {
        localStorage.removeItem(this.storageKey);
    }
}

// ============================================
// КЛАСС ДЛЯ УПРАВЛЕНИЯ ТРАНЗАКЦИЯМИ
// ============================================
class TransactionManager {
    constructor() {
        this.storage = new StorageService();
        this.transactions = [];
        this.loadFromStorage();
    }

    loadFromStorage() {
        this.transactions = this.storage.loadTransactions();
    }

    saveToStorage() {
        this.storage.saveTransactions(this.transactions);
    }

    addTransaction(transaction) {
        this.transactions.unshift(transaction);
        this.saveToStorage();
        return transaction;
    }

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.saveToStorage();
    }

    updateTransaction(id, updates) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            Object.assign(this.transactions[index], updates);
            this.saveToStorage();
        }
    }

    clearAll() {
        this.transactions = [];
        this.storage.clearStorage();
    }

    getFilteredTransactions(filter) {
        let filtered = [...this.transactions];

        if (filter.type === 'income') {
            filtered = filtered.filter(t => t.isIncome());
        } else if (filter.type === 'expense') {
            filtered = filtered.filter(t => !t.isIncome());
        }

        if (filter.category !== 'all') {
            filtered = filtered.filter(t => 
                t.category.toLowerCase().includes(filter.category.toLowerCase())
            );
        }

        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            filtered = filtered.filter(t => 
                t.description.toLowerCase().includes(searchLower) ||
                t.category.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    sortTransactions(transactions, sortConfig) {
        return [...transactions].sort((a, b) => {
            let comparison = 0;

            switch(sortConfig.column) {
                case 'date':
                    comparison = new Date(a.date) - new Date(b.date);
                    break;
                case 'category':
                    comparison = a.category.localeCompare(b.category);
                    break;
                case 'amount':
                case 'amount-desc':
                case 'amount-asc':
                    comparison = a.getAbsoluteAmount() - b.getAbsoluteAmount();
                    break;
                default:
                    comparison = 0;
            }

            if (sortConfig.column === 'amount-desc' || 
                (sortConfig.column === 'amount' && sortConfig.direction === 'desc')) {
                return -comparison;
            } else if (sortConfig.column === 'amount-asc' || 
                      (sortConfig.column === 'amount' && sortConfig.direction === 'asc')) {
                return comparison;
            } else if (sortConfig.column === 'date-desc' || 
                      (sortConfig.column === 'date' && sortConfig.direction === 'desc')) {
                return -comparison;
            } else if (sortConfig.column === 'date-asc' || 
                      (sortConfig.column === 'date' && sortConfig.direction === 'asc')) {
                return comparison;
            } else if (sortConfig.column === 'category') {
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            }

            return comparison;
        });
    }

    getMonthlyData() {
        const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                       'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
        return months.map((month, index) => {
            const year = index > currentMonth ? currentYear - 1 : currentYear;
            
            const monthTransactions = this.transactions.filter(t => {
                const date = new Date(t.date);
                return date.getMonth() === index && date.getFullYear() === year;
            });

            const income = monthTransactions
                .filter(t => t.isIncome())
                .reduce((sum, t) => sum + t.amount, 0);

            const expenses = monthTransactions
                .filter(t => !t.isIncome())
                .reduce((sum, t) => sum + t.getAbsoluteAmount(), 0);

            return {
                month,
                income,
                expenses,
                total: income + expenses,
                year,
                isCurrentMonth: index === currentMonth && year === currentYear
            };
        });
    }

    getCurrentMonthStats() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const currentMonthTransactions = this.transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const income = currentMonthTransactions
            .filter(t => t.isIncome())
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = currentMonthTransactions
            .filter(t => !t.isIncome())
            .reduce((sum, t) => sum + t.getAbsoluteAmount(), 0);

        const categoryTotals = {
            food: 0,
            entertainment: 0,
            shopping: 0,
            investment: 0,
            other: 0
        };

        currentMonthTransactions
            .filter(t => !t.isIncome())
            .forEach(t => {
                const category = t.category.toLowerCase();
                const amount = t.getAbsoluteAmount();

                if (category.includes('еда') || category === 'еда и здоровье') {
                    categoryTotals.food += amount;
                } else if (category.includes('развлечен')) {
                    categoryTotals.entertainment += amount;
                } else if (category.includes('покупк')) {
                    categoryTotals.shopping += amount;
                } else if (category.includes('инвестиц')) {
                    categoryTotals.investment += amount;
                } else {
                    categoryTotals.other += amount;
                }
            });

        return { income, expenses, categoryTotals };
    }

    getLastMonthStats() {
        const currentDate = new Date();
        const lastMonth = currentDate.getMonth() === 0 ? 11 : currentDate.getMonth() - 1;
        const lastMonthYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

        const lastMonthTransactions = this.transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
        });

        const income = lastMonthTransactions
            .filter(t => t.isIncome())
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = lastMonthTransactions
            .filter(t => !t.isIncome())
            .reduce((sum, t) => sum + t.getAbsoluteAmount(), 0);

        return { income, expenses };
    }
}

// ============================================
// КЛАСС ДЛЯ УПРАВЛЕНИЯ UI
// ============================================
class UIManager {
    constructor(transactionManager) {
        this.tm = transactionManager;
        this.currentSort = { column: 'date', direction: 'desc' };
        this.currentFilter = { type: 'all', category: 'all', search: '' };
        this.editingTransactionId = null;
        
        this.updateDashboard = this.updateDashboard.bind(this);
        this.updateOverviewChart = this.updateOverviewChart.bind(this);
        this.updateTransactionsTable = this.updateTransactionsTable.bind(this);
    }

    init() {
        this.setCurrentDate();
        this.setTodayDates();
        this.createFilterAndSortPanels();
        this.enhanceButtons();
        this.updateDashboard();
        this.updateOverviewChart();
        this.updateTransactionsTable();
        this.updateSortBadge();
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.onclick = this.handleWindowClick.bind(this);
        
        const exportBtn = document.querySelector('.export-btn');
        if (exportBtn) {
            exportBtn.onclick = this.exportTransactions.bind(this);
        }
    }

    handleKeyDown(e) {
        if (e.key === "Escape") {
            this.closeModal('incomeModal');
            this.closeModal('expenseModal');
            this.closeModal('editIncomeModal');
            this.closeModal('editExpenseModal');
            document.getElementById('filterPanel').style.display = 'none';
            document.getElementById('sortPanel').style.display = 'none';
        }
        if (e.ctrlKey && e.key === "i") {
            e.preventDefault();
            this.openIncomeModal();
        }
        if (e.ctrlKey && e.key === "e") {
            e.preventDefault();
            this.openExpenseModal();
        }
        if (e.ctrlKey && e.key === "f") {
            e.preventDefault();
            this.toggleFilterPanel();
        }
        if (e.ctrlKey && e.key === "s") {
            e.preventDefault();
            this.toggleSortPanel();
        }
    }

    handleWindowClick(event) {
        const incomeModal = document.getElementById("incomeModal");
        const expenseModal = document.getElementById("expenseModal");
        const editIncomeModal = document.getElementById("editIncomeModal");
        const editExpenseModal = document.getElementById("editExpenseModal");

        if (event.target === incomeModal) this.closeModal("incomeModal");
        if (event.target === expenseModal) this.closeModal("expenseModal");
        if (event.target === editIncomeModal) this.closeModal("editIncomeModal");
        if (event.target === editExpenseModal) this.closeModal("editExpenseModal");
    }

    setCurrentDate() {
        const today = new Date();
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const formattedDate = today.toLocaleDateString('ru-RU', options).replace(',', '');
        
        const datePicker = document.querySelector('.date-picker');
        if (datePicker) {
            datePicker.innerHTML = `<i class="fas fa-calendar"></i> ${formattedDate}`;
        }
    }

    setTodayDates() {
        const today = new Date().toISOString().split("T")[0];
        const incomeDate = document.getElementById("incomeDate");
        const expenseDate = document.getElementById("expenseDate");
        
        if (incomeDate) incomeDate.value = today;
        if (expenseDate) expenseDate.value = today;
    }

    openIncomeModal() {
        document.getElementById("incomeModal").style.display = "block";
        document.body.style.overflow = "hidden";
    }

    openExpenseModal() {
        document.getElementById("expenseModal").style.display = "block";
        document.body.style.overflow = "hidden";
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = "none";
        document.body.style.overflow = "auto";
        
        const today = new Date().toISOString().split("T")[0];
        
        if (modalId === "incomeModal" || modalId === "editIncomeModal") {
            const formId = modalId === "incomeModal" ? "incomeForm" : "editIncomeForm";
            const form = document.getElementById(formId);
            if (form) form.reset();
            
            const dateInput = document.getElementById(modalId === "incomeModal" ? "incomeDate" : "editIncomeDate");
            if (dateInput) dateInput.value = today;
        } else if (modalId === "expenseModal" || modalId === "editExpenseModal") {
            const formId = modalId === "expenseModal" ? "expenseForm" : "editExpenseForm";
            const form = document.getElementById(formId);
            if (form) form.reset();
            
            const dateInput = document.getElementById(modalId === "expenseModal" ? "expenseDate" : "editExpenseDate");
            if (dateInput) dateInput.value = today;
        }
        
        if (modalId.includes('edit')) {
            this.editingTransactionId = null;
        }
    }

    addIncome() {
        const amount = parseFloat(document.getElementById("incomeAmount").value);
        const category = document.getElementById("incomeCategory").value;
        const description = document.getElementById("incomeDescription").value;
        const date = document.getElementById("incomeDate").value;

        if (!amount || !category || !description || !date) {
            alert("Пожалуйста, заполните все поля");
            return;
        }

        const transaction = new Transaction(amount, category, description, date, 'income');
        this.tm.addTransaction(transaction);
        
        this.updateDashboard();
        this.updateOverviewChart();
        this.updateTransactionsTable();
        this.closeModal("incomeModal");
        this.showNotification("Доход успешно добавлен!", "success");
    }

    addExpense() {
        const amount = parseFloat(document.getElementById("expenseAmount").value);
        const category = document.getElementById("expenseCategory").value;
        const description = document.getElementById("expenseDescription").value;
        const date = document.getElementById("expenseDate").value;

        if (!amount || !category || !description || !date) {
            alert("Пожалуйста, заполните все поля");
            return;
        }

        const transaction = new Transaction(amount, category, description, date, 'expense');
        this.tm.addTransaction(transaction);
        
        this.updateDashboard();
        this.updateOverviewChart();
        this.updateTransactionsTable();
        this.closeModal("expenseModal");
        this.showNotification("Расход успешно добавлен!", "success");
    }

    openEditModal(id) {
        const transaction = this.tm.transactions.find(t => t.id === id);
        if (!transaction) return;
        
        this.editingTransactionId = id;
        
        const isIncome = transaction.isIncome();
        const modalId = isIncome ? 'editIncomeModal' : 'editExpenseModal';
        
        this.createEditModal(isIncome);
        
        if (isIncome) {
            document.getElementById('editIncomeAmount').value = transaction.getAbsoluteAmount();
            document.getElementById('editIncomeCategory').value = transaction.category.toLowerCase();
            document.getElementById('editIncomeDescription').value = transaction.description;
            document.getElementById('editIncomeDate').value = transaction.date;
        } else {
            document.getElementById('editExpenseAmount').value = transaction.getAbsoluteAmount();
            let catValue = transaction.category.toLowerCase();
            if (catValue === 'еда и здоровье') catValue = 'food';
            if (catValue === 'развлечения') catValue = 'entertainment';
            if (catValue === 'покупки') catValue = 'shopping';
            if (catValue === 'транспорт') catValue = 'transport';
            if (catValue === 'коммунальные услуги') catValue = 'utilities';
            if (catValue === 'инвестиции') catValue = 'investment';
            if (catValue === 'другое') catValue = 'other';
            document.getElementById('editExpenseCategory').value = catValue;
            document.getElementById('editExpenseDescription').value = transaction.description;
            document.getElementById('editExpenseDate').value = transaction.date;
        }
        
        document.getElementById(modalId).style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    saveEdit() {
        if (!this.editingTransactionId) return;
        
        const transaction = this.tm.transactions.find(t => t.id === this.editingTransactionId);
        if (!transaction) return;
        
        const isIncome = transaction.isIncome();
        
        if (isIncome) {
            const amount = parseFloat(document.getElementById('editIncomeAmount').value);
            const category = document.getElementById('editIncomeCategory').value;
            const description = document.getElementById('editIncomeDescription').value;
            const date = document.getElementById('editIncomeDate').value;
            
            if (!amount || !category || !description || !date) {
                alert("Пожалуйста, заполните все поля");
                return;
            }
            
            transaction.amount = amount;
            if (category === 'salary') transaction.category = 'Зарплата';
            else if (category === 'freelance') transaction.category = 'Фриланс';
            else if (category === 'business') transaction.category = 'Бизнес';
            else if (category === 'investment') transaction.category = 'Инвестиции';
            else if (category === 'other') transaction.category = 'Другое';
            else transaction.category = category.charAt(0).toUpperCase() + category.slice(1);
            transaction.description = description;
            transaction.date = date;
        } else {
            const amount = parseFloat(document.getElementById('editExpenseAmount').value);
            const category = document.getElementById('editExpenseCategory').value;
            const description = document.getElementById('editExpenseDescription').value;
            const date = document.getElementById('editExpenseDate').value;
            
            if (!amount || !category || !description || !date) {
                alert("Пожалуйста, заполните все поля");
                return;
            }
            
            transaction.amount = -amount;
            if (category === 'food') transaction.category = 'Еда и здоровье';
            else if (category === 'entertainment') transaction.category = 'Развлечения';
            else if (category === 'shopping') transaction.category = 'Покупки';
            else if (category === 'transport') transaction.category = 'Транспорт';
            else if (category === 'utilities') transaction.category = 'Коммунальные услуги';
            else if (category === 'investment') transaction.category = 'Инвестиции';
            else if (category === 'other') transaction.category = 'Другое';
            else transaction.category = category.charAt(0).toUpperCase() + category.slice(1);
            transaction.description = description;
            transaction.date = date;
        }
        
        this.tm.saveToStorage();
        this.updateDashboard();
        this.updateOverviewChart();
        this.updateTransactionsTable();
        this.closeModal(isIncome ? 'editIncomeModal' : 'editExpenseModal');
        this.showNotification('Транзакция успешно обновлена!', 'success');
        
        this.editingTransactionId = null;
    }

    createEditModal(isIncome) {
        const modalId = isIncome ? 'editIncomeModal' : 'editExpenseModal';
        
        if (document.getElementById(modalId)) return;
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        
        const title = isIncome ? 'Редактирование дохода' : 'Редактирование расхода';
        const categories = isIncome 
            ? ['salary', 'freelance', 'business', 'investment', 'other']
            : ['food', 'entertainment', 'shopping', 'transport', 'utilities', 'investment', 'other'];
        
        const categoryNames = isIncome
            ? ['Зарплата', 'Фриланс', 'Бизнес', 'Инвестиции', 'Другое']
            : ['Еда и здоровье', 'Развлечения', 'Покупки', 'Транспорт', 'Коммунальные услуги', 'Инвестиции', 'Другое'];
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${title}</h2>
                    <button class="close-btn" onclick="app.uiManager.closeModal('${modalId}')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="${isIncome ? 'editIncomeForm' : 'editExpenseForm'}">
                        <div class="form-group">
                            <label class="form-label">Сумма (₽)</label>
                            <input type="number" class="form-input" id="${isIncome ? 'editIncomeAmount' : 'editExpenseAmount'}" placeholder="Введите сумму" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Категория</label>
                            <select class="form-select" id="${isIncome ? 'editIncomeCategory' : 'editExpenseCategory'}" required>
                                <option value="">Выберите категорию</option>
                                ${categories.map((cat, idx) => `<option value="${cat}">${categoryNames[idx]}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Описание (название)</label>
                            <input type="text" class="form-input" id="${isIncome ? 'editIncomeDescription' : 'editExpenseDescription'}" placeholder="Введите описание" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Дата</label>
                            <input type="date" class="form-input" id="${isIncome ? 'editIncomeDate' : 'editExpenseDate'}" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="app.uiManager.closeModal('${modalId}')">Отмена</button>
                    <button class="btn btn-primary" onclick="app.uiManager.saveEdit()">Сохранить изменения</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    deleteTransaction(id) {
        if (confirm("Удалить эту транзакцию?")) {
            this.tm.deleteTransaction(id);
            this.updateDashboard();
            this.updateOverviewChart();
            this.updateTransactionsTable();
            this.showNotification("Транзакция удалена", "info");
        }
    }

    clearAllData() {
        if (confirm("Вы уверены, что хотите удалить ВСЕ транзакции?")) {
            this.tm.clearAll();
            this.updateDashboard();
            this.updateOverviewChart();
            this.updateTransactionsTable();
            this.showNotification("Все данные очищены", "info");
        }
    }

    updateDashboard() {
        const currentStats = this.tm.getCurrentMonthStats();
        const lastStats = this.tm.getLastMonthStats();
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        this._updateElement(".income-amount", `${currentStats.income.toFixed(2)} ₽`);
        this._updateElement(".expense-amount", `${currentStats.expenses.toFixed(2)} ₽`);
        this._updateElement(".total-expenses", `${currentStats.expenses.toFixed(2)} ₽`);

        this._updatePercentage(
            '.card:first-child .change',
            currentStats.income,
            lastStats.income,
            true
        );

        this._updatePercentage(
            '.card:nth-child(2) .change',
            currentStats.expenses,
            lastStats.expenses,
            false
        );

        this._updateElement(".category-amount-food", `${currentStats.categoryTotals.food.toFixed(2)} ₽`);
        this._updateElement(".category-amount-entertainment", `${currentStats.categoryTotals.entertainment.toFixed(2)} ₽`);
        this._updateElement(".category-amount-shopping", `${currentStats.categoryTotals.shopping.toFixed(2)} ₽`);
        this._updateElement(".category-amount-investment", `${currentStats.categoryTotals.investment.toFixed(2)} ₽`);
        this._updateElement(".category-amount-other", `${currentStats.categoryTotals.other.toFixed(2)} ₽`);

        const periodValues = document.querySelectorAll(".period-values span");
        if (periodValues.length >= 3) {
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            periodValues[0].textContent = `${Math.round(currentStats.expenses / daysInMonth) || 0} ₽`;
            periodValues[1].textContent = `${Math.round(currentStats.expenses / 4) || 0} ₽`;
            periodValues[2].textContent = `${currentStats.expenses.toFixed(2)} ₽`;
        }
    }

    _updateElement(selector, value) {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    }

    _updatePercentage(selector, current, last, isIncome) {
        const element = document.querySelector(selector);
        if (!element) return;

        let percent = 0;
        let icon = 'fa-arrow-up';
        let color = '#10b981';

        if (last > 0) {
            percent = ((current - last) / last * 100).toFixed(1);
            if (percent > 0) {
                icon = 'fa-arrow-up';
                color = isIncome ? '#10b981' : '#ef4444';
            } else if (percent < 0) {
                icon = 'fa-arrow-down';
                color = isIncome ? '#ef4444' : '#10b981';
                percent = Math.abs(percent);
            }
        } else if (current > 0) {
            percent = 100;
        }

        element.innerHTML = `
            <i class="fas ${icon}" style="color: ${color}"></i>
            <span style="color: ${color}">${percent}% против прошлого месяца</span>
        `;
    }

    updateOverviewChart() {
        const container = document.querySelector('.chart-container');
        if (!container) return;

        const monthlyData = this.tm.getMonthlyData();
        const maxValue = Math.max(...monthlyData.flatMap(d => [d.income, d.expenses]), 1);
        const MAX_BAR_HEIGHT = 170;

        container.innerHTML = '';

        monthlyData.forEach(data => {
            const wrapper = this._createChartBar(data, maxValue, MAX_BAR_HEIGHT);
            container.appendChild(wrapper);
        });
    }

    _createChartBar(data, maxValue, maxHeight) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';

        const barContainer = document.createElement('div');
        barContainer.className = 'chart-bar-container';

        const scale = maxHeight / maxValue;
        let incomeHeight = Math.min(data.income * scale, maxHeight);
        let expenseHeight = Math.min(data.expenses * scale, maxHeight);

        if (incomeHeight + expenseHeight > maxHeight) {
            const factor = maxHeight / (incomeHeight + expenseHeight);
            incomeHeight *= factor;
            expenseHeight *= factor;
        }

        barContainer.style.height = (incomeHeight + expenseHeight) + 'px';

        if (data.expenses > 0) {
            barContainer.appendChild(this._createBarSegment(expenseHeight, '#ef4444', 0));
        }

        if (data.income > 0) {
            barContainer.appendChild(this._createBarSegment(incomeHeight, '#10b981', expenseHeight));
        }

        if (data.income === 0 && data.expenses === 0) {
            barContainer.style.height = '4px';
            barContainer.style.backgroundColor = '#f1f5f9';
        }

        wrapper.appendChild(barContainer);
        wrapper.appendChild(this._createMonthLabel(data));

        return wrapper;
    }

    _createBarSegment(height, color, bottom) {
        const bar = document.createElement('div');
        bar.style.cssText = `
            height: ${height}px;
            width: 100%;
            background-color: ${color};
            position: absolute;
            bottom: ${bottom}px;
            left: 0;
            border-radius: 0;
        `;
        return bar;
    }

    _createMonthLabel(data) {
        const label = document.createElement('div');
        label.className = 'chart-label';
        if (data.isCurrentMonth) {
            label.classList.add('current-month');
        }
        label.textContent = data.month;
        return label;
    }

    updateTransactionsTable() {
        const tbody = document.querySelector(".transactions-table tbody");
        if (!tbody) return;

        tbody.innerHTML = "";

        let filteredTransactions = this.tm.getFilteredTransactions(this.currentFilter);
        const sortedTransactions = this.tm.sortTransactions(filteredTransactions, this.currentSort);

        if (sortedTransactions.length === 0) {
            const row = document.createElement("tr");
            let message = "Нет транзакций, соответствующих вашим фильтрам.";
            if (this.tm.transactions.length === 0) {
                message = "Пока нет транзакций. Нажмите + или - чтобы добавить первую транзакцию!";
            }
            row.innerHTML = `<td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">${message}</td>`;
            tbody.appendChild(row);
            return;
        }

        const recentTransactions = sortedTransactions.slice(0, 10);

        recentTransactions.forEach(transaction => {
            const row = document.createElement("tr");
            const formattedDate = new Date(transaction.date).toLocaleDateString("ru-RU", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });

            const amountDisplay = transaction.isIncome()
                ? `+${transaction.amount.toFixed(2)} ₽`
                : `-${transaction.getAbsoluteAmount().toFixed(2)} ₽`;

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${transaction.category}</td>
                <td>${transaction.description || '-'}</td>
                <td style="color: ${transaction.isIncome() ? "#10b981" : "#ef4444"}">${amountDisplay}</td>
                <td><span class="status-success">${transaction.status}</span></td>
                <td>
                    <button class="action-btn" onclick="app.uiManager.openEditModal(${transaction.id})" style="margin-right: 5px;" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="app.uiManager.deleteTransaction(${transaction.id})" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });

        this._updateFilterInfo(filteredTransactions.length);
    }

    _updateFilterInfo(filteredCount) {
        let filterInfo = document.querySelector('.filter-info');
        if (!filterInfo) {
            filterInfo = document.createElement('div');
            filterInfo.className = 'filter-info';
            filterInfo.style.cssText = `
                font-size: 0.875rem;
                color: #6b7280;
                margin-top: 0.5rem;
                padding: 0.5rem;
                background: #f9fafb;
                border-radius: 6px;
            `;
            const transactionsSection = document.querySelector('.transactions-section');
            if (transactionsSection) {
                transactionsSection.appendChild(filterInfo);
            }
        }

        if (this.currentFilter.type !== 'all' || 
            this.currentFilter.category !== 'all' || 
            this.currentFilter.search) {
            let filterText = 'Активные фильтры: ';
            const filters = [];
            if (this.currentFilter.type !== 'all') {
                filters.push(`Тип: ${this.currentFilter.type === 'income' ? 'Доходы' : 'Расходы'}`);
            }
            if (this.currentFilter.category !== 'all') {
                filters.push(`Категория: ${this.currentFilter.category}`);
            }
            if (this.currentFilter.search) {
                filters.push(`Поиск: "${this.currentFilter.search}"`);
            }
            filterText += filters.join(', ');
            filterText += ` (показано ${filteredCount} из ${this.tm.transactions.length} транзакций)`;
            filterInfo.textContent = filterText;
            filterInfo.style.display = 'block';
        } else {
            filterInfo.style.display = 'none';
        }
    }

    applyAdvancedSort() {
        const sortType = document.getElementById('sortType').value;
        const sortDirection = document.getElementById('sortDirection').value;

        if (sortType === 'date') {
            this.currentSort.column = sortDirection === 'newest' ? 'date-desc' : 'date-asc';
            this.currentSort.direction = sortDirection === 'newest' ? 'desc' : 'asc';
        } else if (sortType === 'amount') {
            this.currentSort.column = sortDirection === 'highest' ? 'amount-desc' : 'amount-asc';
            this.currentSort.direction = sortDirection === 'highest' ? 'desc' : 'asc';
        } else if (sortType === 'category') {
            this.currentSort.column = 'category';
            this.currentSort.direction = sortDirection === 'az' ? 'asc' : 'desc';
        }

        this.updateTransactionsTable();
        this.updateSortBadge();
        document.getElementById('sortPanel').style.display = 'none';

        this.showNotification(`Сортировка: ${this._getSortDescription()}`, 'info');
    }

    _getSortDescription() {
        if (this.currentSort.column === 'date-desc') return 'сначала новые';
        if (this.currentSort.column === 'date-asc') return 'сначала старые';
        if (this.currentSort.column === 'amount-desc') return 'сначала большие суммы';
        if (this.currentSort.column === 'amount-asc') return 'сначала малые суммы';
        if (this.currentSort.column === 'category') {
            return this.currentSort.direction === 'asc' ? 'категория А-Я' : 'категория Я-А';
        }
        return 'дате';
    }

    updateSortBadge() {
        let sortBadge = document.querySelector('.sort-badge');
        if (!sortBadge) {
            sortBadge = document.createElement('div');
            sortBadge.className = 'sort-badge';
            sortBadge.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.25rem 0.75rem;
                background: #f3f4f6;
                border-radius: 16px;
                font-size: 0.875rem;
                color: #374151;
                margin-left: 1rem;
            `;

            const filtersDiv = document.querySelector('.filters');
            if (filtersDiv) {
                filtersDiv.appendChild(sortBadge);
            }
        }

        let icon = 'fa-calendar';
        if (this.currentSort.column.includes('amount')) icon = 'fa-ruble-sign';
        if (this.currentSort.column === 'category') icon = 'fa-font';

        let text = this._getSortDescription();

        sortBadge.innerHTML = `
            <i class="fas ${icon}" style="font-size: 0.75rem;"></i>
            <span>${text}</span>
            <i class="fas fa-times" style="cursor: pointer; font-size: 0.75rem; opacity: 0.7;" onclick="app.uiManager.resetSort()"></i>
        `;
    }

    resetSort() {
        this.currentSort = {
            column: 'date',
            direction: 'desc'
        };

        document.getElementById('sortType').value = 'date';
        document.getElementById('sortDirection').value = 'newest';

        this.updateTransactionsTable();

        const sortBadge = document.querySelector('.sort-badge');
        if (sortBadge) {
            sortBadge.remove();
        }

        this.showNotification('Сортировка сброшена', 'info');
    }

    toggleSortPanel() {
        const panel = document.getElementById('sortPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    toggleFilterPanel() {
        const panel = document.getElementById('filterPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    applyFilters() {
        const typeFilter = document.getElementById('filterType').value;
        const categoryFilter = document.getElementById('filterCategory').value;
        const searchFilter = document.getElementById('filterSearch').value;

        this.currentFilter = {
            type: typeFilter,
            category: categoryFilter,
            search: searchFilter
        };

        this.updateTransactionsTable();
        document.getElementById('filterPanel').style.display = 'none';

        if (typeFilter !== 'all' || categoryFilter !== 'all' || searchFilter) {
            this.showNotification('Фильтры применены', 'info');
        }
    }

    resetFilters() {
        this.currentFilter = {
            type: 'all',
            category: 'all',
            search: ''
        };

        document.getElementById('filterType').value = 'all';
        document.getElementById('filterCategory').value = 'all';
        document.getElementById('filterSearch').value = '';

        this.updateTransactionsTable();
        document.getElementById('filterPanel').style.display = 'none';
        this.showNotification('Фильтры сброшены', 'info');
    }

    updateFilterCategories() {
        const typeFilter = document.getElementById('filterType').value;
        const categorySelect = document.getElementById('filterCategory');

        const currentValue = categorySelect.value;
        categorySelect.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'Все категории';
        categorySelect.appendChild(allOption);

        if (typeFilter === 'income') {
            const incomeCategories = ['Зарплата', 'Фриланс', 'Бизнес', 'Инвестиции', 'Другое'];
            incomeCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.toLowerCase();
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
        } else if (typeFilter === 'expense') {
            const expenseCategories = ['Еда и здоровье', 'Развлечения', 'Покупки', 'Транспорт', 'Коммунальные услуги', 'Инвестиции', 'Другое'];
            expenseCategories.forEach(cat => {
                let value = cat.toLowerCase();
                if (cat === 'Еда и здоровье') value = 'food';
                if (cat === 'Развлечения') value = 'entertainment';
                if (cat === 'Покупки') value = 'shopping';
                if (cat === 'Транспорт') value = 'transport';
                if (cat === 'Коммунальные услуги') value = 'utilities';
                if (cat === 'Инвестиции') value = 'investment';
                if (cat === 'Другое') value = 'other';
                const option = document.createElement('option');
                option.value = value;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
        } else {
            const allCategories = ['Зарплата', 'Фриланс', 'Бизнес', 'Еда и здоровье', 'Развлечения', 'Покупки', 'Транспорт', 'Коммунальные услуги', 'Инвестиции', 'Другое'];
            allCategories.forEach(cat => {
                let value = cat.toLowerCase();
                if (cat === 'Еда и здоровье') value = 'food';
                if (cat === 'Развлечения') value = 'entertainment';
                if (cat === 'Покупки') value = 'shopping';
                if (cat === 'Транспорт') value = 'transport';
                if (cat === 'Коммунальные услуги') value = 'utilities';
                const option = document.createElement('option');
                option.value = value;
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
        }

        if (currentValue && currentValue !== 'all') {
            categorySelect.value = currentValue;
        }
    }

    createFilterAndSortPanels() {
        const transactionsSection = document.querySelector('.transactions-section');
        if (!transactionsSection) return;

        const sortPanel = document.createElement('div');
        sortPanel.id = 'sortPanel';
        sortPanel.style.cssText = `
            display: none;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        `;

        sortPanel.innerHTML = `
            <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: #111827;">Сортировка транзакций</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Сортировать по</label>
                    <select id="sortType" class="form-select" style="width: 100%;">
                        <option value="date">Дате</option>
                        <option value="amount">Сумме</option>
                        <option value="category">Категории</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Порядок</label>
                    <select id="sortDirection" class="form-select" style="width: 100%;">
                        <option value="newest" data-type="date">Сначала новые</option>
                        <option value="oldest" data-type="date">Сначала старые</option>
                        <option value="highest" data-type="amount">Сначала большие</option>
                        <option value="lowest" data-type="amount">Сначала малые</option>
                        <option value="az" data-type="category">От А до Я</option>
                        <option value="za" data-type="category">От Я до А</option>
                    </select>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="document.getElementById('sortPanel').style.display='none'">Отмена</button>
                <button class="btn btn-primary" onclick="app.uiManager.applyAdvancedSort()">Применить</button>
            </div>
        `;

        const filterPanel = document.createElement('div');
        filterPanel.id = 'filterPanel';
        filterPanel.style.cssText = `
            display: none;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        `;

        filterPanel.innerHTML = `
            <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: #111827;">Фильтрация транзакций</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Тип</label>
                    <select id="filterType" class="form-select" style="width: 100%;" onchange="app.uiManager.updateFilterCategories()">
                        <option value="all">Все транзакции</option>
                        <option value="income">Только доходы</option>
                        <option value="expense">Только расходы</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Категория</label>
                    <select id="filterCategory" class="form-select" style="width: 100%;">
                        <option value="all">Все категории</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Поиск</label>
                    <input type="text" id="filterSearch" class="form-input" placeholder="Поиск..." style="width: 100%;">
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="app.uiManager.resetFilters()">Сбросить</button>
                <button class="btn btn-primary" onclick="app.uiManager.applyFilters()">Применить</button>
            </div>
        `;

        transactionsSection.insertBefore(sortPanel, transactionsSection.querySelector('.transactions-table'));
        transactionsSection.insertBefore(filterPanel, transactionsSection.querySelector('.transactions-table'));

        document.getElementById('sortType').addEventListener('change', function() {
            const type = this.value;
            const directionSelect = document.getElementById('sortDirection');
            const options = directionSelect.options;

            for (let option of options) {
                option.style.display = option.dataset.type === type ? 'block' : 'none';
            }

            for (let option of options) {
                if (option.style.display !== 'none') {
                    directionSelect.value = option.value;
                    break;
                }
            }
        });

        this.updateFilterCategories();
        document.getElementById('sortType').dispatchEvent(new Event('change'));
    }

    enhanceButtons() {
        const filterBtn = document.querySelector('.filters .filter-btn:last-child');
        if (filterBtn) {
            filterBtn.onclick = this.toggleFilterPanel.bind(this);
        }

        const sortBtn = document.querySelector('.filters .filter-btn:first-child');
        if (sortBtn) {
            sortBtn.innerHTML = '<i class="fas fa-sort"></i> Сортировка';
            sortBtn.onclick = this.toggleSortPanel.bind(this);
        }
    }

    exportTransactions() {
        const dataStr = JSON.stringify(this.tm.transactions.map(t => t.toJSON()), null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `finance_transactions_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.showNotification('Транзакции успешно экспортированы!', 'success');
    }

    showNotification(message, type = "success") {
        const notification = document.createElement("div");
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: ${type === "success" ? "#10b981" : type === "info" ? "#3b82f6" : "#ef4444"};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = "slideOutRight 0.3s ease";
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// ============================================
// API КЛАСС ДЛЯ ПОЛУЧЕНИЯ КУРСОВ ВАЛЮТ
// ============================================
class ExchangeRateAPI {
    constructor() {
        this.apiUrl = 'https://api.exchangerate-api.com/v4/latest/';
    }

    async getRate(baseCurrency = 'USD', targetCurrency = 'EUR') {
        try {
            const response = await fetch(`${this.apiUrl}${baseCurrency}`);
            if (!response.ok) throw new Error('Failed to fetch exchange rates');
            const data = await response.json();
            return data.rates[targetCurrency] || 1;
        } catch (error) {
            console.error('Exchange rate API error:', error);
            return 1;
        }
    }
}

// ============================================
// ГЛАВНЫЙ КЛАСС ПРИЛОЖЕНИЯ
// ============================================
class FinanceApp {
    constructor() {
        this.transactionManager = new TransactionManager();
        this.uiManager = new UIManager(this.transactionManager);
        this.exchangeAPI = new ExchangeRateAPI();
        
        window.app = this;
    }

    async init() {
        this.uiManager.init();
        
        try {
            const rate = await this.exchangeAPI.getRate('USD', 'EUR');
            console.log('Current USD to EUR rate:', rate);
            this._displayExchangeRate(rate);
        } catch (error) {
            console.warn('Could not fetch exchange rates');
        }
    }

    _displayExchangeRate(rate) {
        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            const rateElement = document.createElement('div');
            rateElement.className = 'exchange-rate';
            rateElement.style.cssText = `
                background: #f3f4f6;
                border-radius: 8px;
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                color: #374151;
            `;
            rateElement.innerHTML = `<i class="fas fa-exchange-alt"></i> USD/EUR: ${rate.toFixed(2)}`;
            headerControls.appendChild(rateElement);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const app = new FinanceApp();
    app.init();
});