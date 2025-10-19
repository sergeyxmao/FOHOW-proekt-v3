// auth.js - Защита с хэшированием паролей и контактами
class PasswordProtector {
    constructor() {
        // ЗДЕСЬ ВСТАВЬТЕ ХЭШИ ОТ ВАШИХ ПАРОЛЕЙ
        this.validHashes = [
            "5b33003a928495b97792ac286d477b54dd20eb773c74ae2fb3653bc5950ad6dd", // Хэш от пароля

        ];

        this.sessionKey = 'fohowAuth';
        this.modalElement = document.getElementById('auth-modal');
        this.formElement = this.modalElement?.querySelector('[data-auth-form]') || null;
        this.passwordInput = this.formElement?.querySelector('.auth-modal__input') || null;
        this.errorElement = this.modalElement?.querySelector('[data-auth-error]') || null;
        this.submitButton = this.formElement?.querySelector('.auth-modal__submit') || null;
        this.defaultSubmitText = this.submitButton?.textContent || '';
        this.focusableElements = [];
        this.isProcessing = false;

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleDocumentFocus = this.handleDocumentFocus.bind(this);

        if (!this.modalElement || !this.formElement || !this.passwordInput) {
            console.error('Модальное окно авторизации не найдено.');
            return;
        }

        this.formElement.addEventListener('submit', this.handleSubmit);
        this.passwordInput.addEventListener('input', () => this.clearError());
        this.modalElement.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('focusin', this.handleDocumentFocus);

        this.checkAuthentication();
    }

    checkAuthentication() {
        const sessionAuth = sessionStorage.getItem(this.sessionKey);
        if (sessionAuth === 'authenticated') {
            this.hideModalInstantly();
            return;
        }

        this.openModal();
    }

    openModal() {
        if (!this.modalElement) {
            return;
        }

        this.modalElement.removeAttribute('hidden');
        document.body.classList.add('auth-modal-open');
        this.clearError();
        this.formElement?.reset();

        window.requestAnimationFrame(() => {
            this.modalElement.classList.add('auth-modal--visible');
            this.updateFocusableElements();
            this.focusFirstElement();
        });
    }

    hideModalInstantly() {
        if (!this.modalElement) {
            return;
        }
        this.modalElement.setAttribute('hidden', '');
        this.modalElement.classList.remove('auth-modal--visible');
        document.body.classList.remove('auth-modal-open');
    }

    closeModal() {
        if (!this.modalElement) {
            return;
        }

        this.modalElement.classList.remove('auth-modal--visible');
        document.body.classList.remove('auth-modal-open');

        const transitionDuration = 400;
        window.setTimeout(() => {
            if (this.modalElement && !this.modalElement.classList.contains('auth-modal--visible')) {
                this.modalElement.setAttribute('hidden', '');
            }
        }, transitionDuration);
    }

    updateFocusableElements() {
        if (!this.modalElement) {
            this.focusableElements = [];
            return;
        }

        const selectors = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        this.focusableElements = Array.from(this.modalElement.querySelectorAll(selectors)).filter((element) => {
            return element.offsetParent !== null && !element.hasAttribute('aria-hidden');
        });
    }

    focusFirstElement() {
        if (this.passwordInput) {
            this.passwordInput.focus();
            this.passwordInput.select();
            return;
        }

        if (this.focusableElements.length > 0) {
            this.focusableElements[0].focus();
        }
    }

    isModalVisible() {
        return Boolean(this.modalElement && this.modalElement.classList.contains('auth-modal--visible'));
    }

    handleKeyDown(event) {
        if (event.key !== 'Tab' || !this.isModalVisible()) {
            return;
        }

        if (!this.focusableElements.length) {
            this.updateFocusableElements();
        }

        if (!this.focusableElements.length) {
            return;
        }

        const firstElement = this.focusableElements[0];
        const lastElement = this.focusableElements[this.focusableElements.length - 1];
        const isShiftPressed = event.shiftKey;
        const activeElement = document.activeElement;

        if (!activeElement) {
            return;
        }

        if (isShiftPressed && activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!isShiftPressed && activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }

    handleDocumentFocus(event) {
        if (!this.isModalVisible() || !this.modalElement) {
            return;
        }

        if (!this.modalElement.contains(event.target)) {
            this.focusFirstElement();
        }
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (this.isProcessing) {
            return;
        }

        if (!window.crypto || !crypto.subtle) {
            this.displayError('Браузер не поддерживает проверку пароля.');
            return;
        }

        const password = (this.passwordInput?.value || '').trim();

        if (!password) {
            this.displayError('Введите пароль.');
            this.focusFirstElement();
            return;
        }

        this.togglePendingState(true);

        try {
            const inputHash = await this.sha256(password);

            if (this.validHashes.includes(inputHash)) {
                sessionStorage.setItem(this.sessionKey, 'authenticated');
                this.clearError();
                this.formElement?.reset();
                this.closeModal();
            } else {
                this.displayError('Неверный пароль. Попробуйте ещё раз.');
                this.focusFirstElement();
            }
        } catch (error) {
            console.error('Ошибка проверки пароля', error);
            this.displayError('Не удалось проверить пароль. Попробуйте позже.');
        } finally {
            this.togglePendingState(false);
        }
    }

    togglePendingState(pending) {
        this.isProcessing = pending;

        if (this.submitButton) {
            this.submitButton.disabled = pending;
            this.submitButton.textContent = pending ? 'Проверяем…' : this.defaultSubmitText;
        }
    }

    displayError(message) {
        if (!this.errorElement) {
            return;
        }

        if (!message) {
            this.errorElement.textContent = '';
            this.errorElement.hidden = true;
            return;
        }

        this.errorElement.textContent = message;
        this.errorElement.hidden = false;
    }

    clearError() {
        this.displayError('');
    }

    async sha256(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((value) => value.toString(16).padStart(2, '0')).join('');
    }
}

// Запускаем защиту при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    new PasswordProtector();

});
