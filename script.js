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
        this.status = "Success";
        this.type = type;
    }

    _formatCategory(category, type) {
        if (type === 'expense' && category === 'food') {
            return 'Food & Health';
        }
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
        const t = new Transaction(
            Math.abs(data.amount),
            data.category === 'Food & Health' ? 'food' : data.category.toLowerCase(),
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
        this.apiEndpoint = 'https://api.jsonbin.io/v3/b/'; // Пример API для облачного хранения
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
        
        // Асинхронное сохранение в облако через API
        this._syncToCloud(data).catch(console.warn);
    }

    async _syncToCloud(data) {
        try {
            // Пример интеграции с внешним API (JSONBin.io)
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
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
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

                if (category.includes('food') || category === 'food & health') {
                    categoryTotals.food += amount;
                } else if (category.includes('entertainment')) {
                    categoryTotals.entertainment += amount;
                } else if (category.includes('shopping')) {
                    categoryTotals.shopping += amount;
                } else if (category.includes('investment')) {
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
        
        // Привязка методов к экземпляру
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

    // ===== МЕТОДЫ ДЛЯ РАБОТЫ С ДАТОЙ =====
    setCurrentDate() {
        const today = new Date();
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const formattedDate = today.toLocaleDateString('en-US', options).replace(',', '');
        
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

    // ===== МЕТОДЫ ДЛЯ МОДАЛЬНЫХ ОКОН =====
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

    // ===== МЕТОДЫ ДЛЯ ДОБАВЛЕНИЯ ТРАНЗАКЦИЙ =====
    addIncome() {
        const amount = parseFloat(document.getElementById("incomeAmount").value);
        const category = document.getElementById("incomeCategory").value;
        const description = document.getElementById("incomeDescription").value;
        const date = document.getElementById("incomeDate").value;

        if (!amount || !category || !description || !date) {
            alert("Please fill in all fields");
            return;
        }

        const transaction = new Transaction(amount, category, description, date, 'income');
        this.tm.addTransaction(transaction);
        
        this.updateDashboard();
        this.updateOverviewChart();
        this.updateTransactionsTable();
        this.closeModal("incomeModal");
        this.showNotification("Income added successfully!", "success");
    }

    addExpense() {
        const amount = parseFloat(document.getElementById("expenseAmount").value);
        const category = document.getElementById("expenseCategory").value;
        const description = document.getElementById("expenseDescription").value;
        const date = document.getElementById("expenseDate").value;

        if (!amount || !category || !description || !date) {
            alert("Please fill in all fields");
            return;
        }

        const transaction = new Transaction(amount, category, description, date, 'expense');
        this.tm.addTransaction(transaction);
        
        this.updateDashboard();
        this.updateOverviewChart();
        this.updateTransactionsTable();
        this.closeModal("expenseModal");
        this.showNotification("Expense added successfully!", "success");
    }

    // ===== МЕТОДЫ ДЛЯ РЕДАКТИРОВАНИЯ =====
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
            document.getElementById('editExpenseCategory').value = 
                transaction.category === 'Food & Health' ? 'food' : transaction.category.toLowerCase();
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
                alert("Please fill in all fields");
                return;
            }
            
            transaction.amount = amount;
            transaction.category = category.charAt(0).toUpperCase() + category.slice(1);
            transaction.description = description;
            transaction.date = date;
        } else {
            const amount = parseFloat(document.getElementById('editExpenseAmount').value);
            const category = document.getElementById('editExpenseCategory').value;
            const description = document.getElementById('editExpenseDescription').value;
            const date = document.getElementById('editExpenseDate').value;
            
            if (!amount || !category || !description || !date) {
                alert("Please fill in all fields");
                return;
            }
            
            transaction.amount = -amount;
            transaction.category = category === 'food' ? 'Food & Health' : category.charAt(0).toUpperCase() + category.slice(1);
            transaction.description = description;
            transaction.date = date;
        }
        
        this.tm.saveToStorage();
        this.updateDashboard();
        this.updateOverviewChart();
        this.updateTransactionsTable();
        this.closeModal(isIncome ? 'editIncomeModal' : 'editExpenseModal');
        this.showNotification('Transaction updated successfully!', 'success');
        
        this.editingTransactionId = null;
    }

    createEditModal(isIncome) {
        const modalId = isIncome ? 'editIncomeModal' : 'editExpenseModal';
        
        if (document.getElementById(modalId)) return;
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        
        const title = isIncome ? 'Edit Income' : 'Edit Expense';
        const categories = isIncome 
            ? ['Salary', 'Freelance', 'Business', 'Investment', 'Other']
            : ['Food', 'Entertainment', 'Shopping', 'Transport', 'Utilities', 'Investment', 'Other'];
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">${title}</h2>
                    <button class="close-btn" onclick="app.uiManager.closeModal('${modalId}')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="${isIncome ? 'editIncomeForm' : 'editExpenseForm'}">
                        <div class="form-group">
                            <label class="form-label">Amount ($)</label>
                            <input type="number" class="form-input" id="${isIncome ? 'editIncomeAmount' : 'editExpenseAmount'}" placeholder="Enter amount" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select class="form-select" id="${isIncome ? 'editIncomeCategory' : 'editExpenseCategory'}" required>
                                <option value="">Select category</option>
                                ${categories.map(cat => {
                                    const value = cat === 'Food' ? 'food' : cat.toLowerCase();
                                    const text = cat === 'Food' ? 'Food & Health' : cat;
                                    return `<option value="${value}">${text}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description (Name)</label>
                            <input type="text" class="form-input" id="${isIncome ? 'editIncomeDescription' : 'editExpenseDescription'}" placeholder="Enter description" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date</label>
                            <input type="date" class="form-input" id="${isIncome ? 'editIncomeDate' : 'editExpenseDate'}" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="app.uiManager.closeModal('${modalId}')">Cancel</button>
                    <button class="btn btn-primary" onclick="app.uiManager.saveEdit()">Save Changes</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    deleteTransaction(id) {
        if (confirm("Delete this transaction?")) {
            this.tm.deleteTransaction(id);
            this.updateDashboard();
            this.updateOverviewChart();
            this.updateTransactionsTable();
            this.showNotification("Transaction deleted", "info");
        }
    }

    clearAllData() {
        if (confirm("Are you sure you want to delete ALL transactions?")) {
            this.tm.clearAll();
            this.updateDashboard();
            this.updateOverviewChart();
            this.updateTransactionsTable();
            this.showNotification("All data cleared", "info");
        }
    }

    // ===== МЕТОДЫ ДЛЯ ОБНОВЛЕНИЯ ИНТЕРФЕЙСА =====
    updateDashboard() {
        const currentStats = this.tm.getCurrentMonthStats();
        const lastStats = this.tm.getLastMonthStats();
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Обновление основных сумм
        this._updateElement(".income-amount", `$${currentStats.income.toFixed(2)}`);
        this._updateElement(".expense-amount", `$${currentStats.expenses.toFixed(2)}`);
        this._updateElement(".total-expenses", `$${currentStats.expenses.toFixed(2)}`);

        // Расчет и обновление процентов для доходов
        this._updatePercentage(
            '.card:first-child .change',
            currentStats.income,
            lastStats.income,
            true
        );

        // Расчет и обновление процентов для расходов
        this._updatePercentage(
            '.card:nth-child(2) .change',
            currentStats.expenses,
            lastStats.expenses,
            false
        );

        // Обновление категорий
        this._updateElement(".category-amount-food", `$${currentStats.categoryTotals.food.toFixed(2)}`);
        this._updateElement(".category-amount-entertainment", `$${currentStats.categoryTotals.entertainment.toFixed(2)}`);
        this._updateElement(".category-amount-shopping", `$${currentStats.categoryTotals.shopping.toFixed(2)}`);
        this._updateElement(".category-amount-investment", `$${currentStats.categoryTotals.investment.toFixed(2)}`);
        this._updateElement(".category-amount-other", `$${currentStats.categoryTotals.other.toFixed(2)}`);

        // Обновление периода
        const periodValues = document.querySelectorAll(".period-values span");
        if (periodValues.length >= 3) {
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            periodValues[0].textContent = `$${Math.round(currentStats.expenses / daysInMonth) || 0}`;
            periodValues[1].textContent = `$${Math.round(currentStats.expenses / 4) || 0}`;
            periodValues[2].textContent = `$${currentStats.expenses.toFixed(2)}`;
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
            <span style="color: ${color}">${percent}% vs Last month</span>
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
            let message = "No transactions match your filters.";
            if (this.tm.transactions.length === 0) {
                message = "No transactions yet. Click + or - to add your first transaction!";
            }
            row.innerHTML = `<td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">${message}</td>`;
            tbody.appendChild(row);
            return;
        }

        const recentTransactions = sortedTransactions.slice(0, 10);

        recentTransactions.forEach(transaction => {
            const row = document.createElement("tr");
            const formattedDate = new Date(transaction.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });

            const amountDisplay = transaction.isIncome()
                ? `+$${transaction.amount.toFixed(2)}`
                : `-$${transaction.getAbsoluteAmount().toFixed(2)}`;

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${transaction.category}</td>
                <td>${transaction.description || '-'}</td>
                <td style="color: ${transaction.isIncome() ? "#10b981" : "#ef4444"}">${amountDisplay}</td>
                <td><span class="status-success">${transaction.status}</span></td>
                <td>
                    <button class="action-btn" onclick="app.uiManager.openEditModal(${transaction.id})" style="margin-right: 5px;" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="app.uiManager.deleteTransaction(${transaction.id})" title="Delete">
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
            let filterText = 'Active filters: ';
            const filters = [];
            if (this.currentFilter.type !== 'all') {
                filters.push(`Type: ${this.currentFilter.type === 'income' ? 'Income' : 'Expenses'}`);
            }
            if (this.currentFilter.category !== 'all') {
                filters.push(`Category: ${this.currentFilter.category}`);
            }
            if (this.currentFilter.search) {
                filters.push(`Search: "${this.currentFilter.search}"`);
            }
            filterText += filters.join(', ');
            filterText += ` (showing ${filteredCount} of ${this.tm.transactions.length} transactions)`;
            filterInfo.textContent = filterText;
            filterInfo.style.display = 'block';
        } else {
            filterInfo.style.display = 'none';
        }
    }

    // ===== МЕТОДЫ ДЛЯ СОРТИРОВКИ И ФИЛЬТРАЦИИ =====
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

        this.showNotification(`Sorted by ${this._getSortDescription()}`, 'info');
    }

    _getSortDescription() {
        if (this.currentSort.column === 'date-desc') return 'newest first';
        if (this.currentSort.column === 'date-asc') return 'oldest first';
        if (this.currentSort.column === 'amount-desc') return 'highest amount';
        if (this.currentSort.column === 'amount-asc') return 'lowest amount';
        if (this.currentSort.column === 'category') {
            return this.currentSort.direction === 'asc' ? 'category A-Z' : 'category Z-A';
        }
        return 'date';
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
        if (this.currentSort.column.includes('amount')) icon = 'fa-dollar-sign';
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

        this.showNotification('Sort reset to default', 'info');
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
            this.showNotification('Filters applied', 'info');
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
        this.showNotification('Filters reset', 'info');
    }

    updateFilterCategories() {
        const typeFilter = document.getElementById('filterType').value;
        const categorySelect = document.getElementById('filterCategory');

        const currentValue = categorySelect.value;
        categorySelect.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Categories';
        categorySelect.appendChild(allOption);

        if (typeFilter === 'income') {
            const incomeCategories = ['Salary', 'Freelance', 'Business', 'Investment', 'Other'];
            incomeCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.toLowerCase();
                option.textContent = cat;
                categorySelect.appendChild(option);
            });
        } else if (typeFilter === 'expense') {
            const expenseCategories = ['Food', 'Entertainment', 'Shopping', 'Transport', 'Utilities', 'Investment', 'Other'];
            expenseCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.toLowerCase();
                option.textContent = cat === 'Food' ? 'Food & Health' : cat;
                categorySelect.appendChild(option);
            });
        } else {
            const allCategories = ['Salary', 'Freelance', 'Business', 'Food', 'Entertainment', 'Shopping', 'Transport', 'Utilities', 'Investment', 'Other'];
            allCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.toLowerCase();
                option.textContent = cat === 'Food' ? 'Food & Health' : cat;
                categorySelect.appendChild(option);
            });
        }

        if (currentValue && currentValue !== 'all') {
            categorySelect.value = currentValue;
        }
    }

    // ===== МЕТОДЫ ДЛЯ СОЗДАНИЯ ПАНЕЛЕЙ =====
    createFilterAndSortPanels() {
        const transactionsSection = document.querySelector('.transactions-section');
        if (!transactionsSection) return;

        // Панель сортировки
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
            <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: #111827;">Sort Transactions</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Sort by</label>
                    <select id="sortType" class="form-select" style="width: 100%;">
                        <option value="date">Date</option>
                        <option value="amount">Amount</option>
                        <option value="category">Category</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Order</label>
                    <select id="sortDirection" class="form-select" style="width: 100%;">
                        <option value="newest" data-type="date">Newest first</option>
                        <option value="oldest" data-type="date">Oldest first</option>
                        <option value="highest" data-type="amount">Highest first</option>
                        <option value="lowest" data-type="amount">Lowest first</option>
                        <option value="az" data-type="category">A to Z</option>
                        <option value="za" data-type="category">Z to A</option>
                    </select>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="document.getElementById('sortPanel').style.display='none'">Cancel</button>
                <button class="btn btn-primary" onclick="app.uiManager.applyAdvancedSort()">Apply Sort</button>
            </div>
        `;

        // Панель фильтров
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
            <h4 style="margin: 0 0 1rem 0; font-size: 1rem; color: #111827;">Filter Transactions</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Type</label>
                    <select id="filterType" class="form-select" style="width: 100%;" onchange="app.uiManager.updateFilterCategories()">
                        <option value="all">All Transactions</option>
                        <option value="income">Income Only</option>
                        <option value="expense">Expenses Only</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Category</label>
                    <select id="filterCategory" class="form-select" style="width: 100%;">
                        <option value="all">All Categories</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; color: #374151;">Search</label>
                    <input type="text" id="filterSearch" class="form-input" placeholder="Search..." style="width: 100%;">
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="app.uiManager.resetFilters()">Reset</button>
                <button class="btn btn-primary" onclick="app.uiManager.applyFilters()">Apply Filters</button>
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
            sortBtn.innerHTML = '<i class="fas fa-sort"></i> Sort';
            sortBtn.onclick = this.toggleSortPanel.bind(this);
        }
    }

    // ===== МЕТОДЫ ДЛЯ ЭКСПОРТА =====
    exportTransactions() {
        const dataStr = JSON.stringify(this.tm.transactions.map(t => t.toJSON()), null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `finance_transactions_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.showNotification('Transactions exported successfully!', 'success');
    }

    // ===== МЕТОДЫ ДЛЯ УВЕДОМЛЕНИЙ =====
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
        
        // Делаем приложение глобально доступным для onclick-обработчиков
        window.app = this;
    }

    async init() {
        // Инициализация UI
        this.uiManager.init();
        
        // Пример интеграции с API - получение курса валют
        try {
            const rate = await this.exchangeAPI.getRate('USD', 'EUR');
            console.log('Current USD to EUR rate:', rate);
            
            // Можно добавить отображение курса в интерфейсе
            this._displayExchangeRate(rate);
        } catch (error) {
            console.warn('Could not fetch exchange rates');
        }
    }

    _displayExchangeRate(rate) {
        // Добавляем информацию о курсе валют в интерфейс
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

// ============================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    const app = new FinanceApp();
    app.init();
});