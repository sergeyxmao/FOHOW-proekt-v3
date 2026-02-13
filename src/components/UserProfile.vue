<template>
  <div
    :class="[
      'user-profile',
      { 'user-profile--modern': props.isModernTheme }
    ]"
  >
    <div class="profile-header">
      <h2>Мой профиль</h2>
      <button
        class="tariff-btn"
        :style="getPlanBadgeStyle()"
        @click="selectTab('tariffs')"
        title="Перейти в раздел тарифы"
      >
        {{ subscriptionStore.currentPlan?.name || 'Не определен' }}
      </button>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <!-- Показываем основной контент ТОЛЬКО ЕСЛИ объект user существует и загружен -->
    <div v-if="user" class="profile-layout">
      <!-- ============================================ -->
      <!-- ЛЕВАЯ ПАНЕЛЬ: Аватар + Меню -->
      <!-- ============================================ -->
      <div class="profile-sidebar">
        <!-- Аватар -->
        <div
          class="profile-avatar-section"
          :class="{ 'profile-avatar-section--verified': user.is_verified }"
        >
          <div
            :class="['avatar-wrapper', 'avatar-wrapper--clickable', { 'avatar-wrapper--verified': user.is_verified }]"
            @click="openAvatarEdit"
            title="Нажмите для редактирования аватара"
          >
            <img
              v-if="user.avatar_url"
              :key="avatarKey"
              :src="getAvatarUrl(user.avatar_url)"
              alt="Аватар"
              class="profile-avatar"
            >
            <div v-else class="profile-avatar-placeholder">
              {{ getInitials(user.username || user.email) }}
            </div>
            <div class="avatar-edit-overlay">
              <span class="avatar-edit-icon">📷</span>
            </div>
          </div>
        </div>

        <!-- Вертикальное меню -->
        <nav class="sidebar-menu">
          <div
            v-for="(group, groupIndex) in tabGroups"
            :key="group.label"
            class="menu-group"
          >
            <div v-if="groupIndex > 0" class="menu-group__divider"></div>
            <div class="menu-group__label">{{ group.label }}</div>
            <button
              v-for="tab in group.tabs"
              :key="tab.id"
              :class="['menu-item', { 'menu-item--active': activeTab === tab.id && !isAvatarEditMode }]"
              @click="selectTab(tab.id)"
            >
              <span class="menu-icon">{{ tab.icon }}</span>
              <span class="menu-label">{{ tab.label }}</span>
            </button>
          </div>
        </nav>
      </div>

      <!-- ============================================ -->
      <!-- ПРАВАЯ ПАНЕЛЬ: Контент -->
      <!-- ============================================ -->
      <div class="profile-main">
        <div class="content-area">
          <!-- ===== TAB 1: Основная информация ===== -->
          <div v-if="activeTab === 'basic' && !isAvatarEditMode" class="tab-panel">
            <!-- Grace-период предупреждение -->
            <div v-if="isInGracePeriod()" class="grace-warning">
              <div class="grace-warning-icon">⚠️</div>
              <div class="grace-warning-content">
                <p class="grace-warning-title">Льготный период доступа</p>
                <p class="grace-warning-text">
                  Срок вашей подписки истек, но доступ сохранен до <strong>{{ getGracePeriodDate() }}</strong>.
                  Продлите подписку, чтобы не потерять доступ к платным функциям.
                </p>
                <button @click="activeTab = 'tariffs'" class="grace-warning-button">
                  Продлить подписку
                </button>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <label>Email:</label>
                <span>{{ user.email }}</span>
              </div>

              <div class="info-item">
                <label>Имя пользователя:</label>
                <span>{{ user.username || 'Не указано' }}</span>
              </div>

              <div class="info-item">
                <label>Дата регистрации:</label>
                <span>{{ formatDate(user.created_at) }}</span>
              </div>

              <div class="info-item">
                <label>Текущий тариф:</label>
                <span class="plan-badge" :style="getPlanBadgeStyle()">
                  {{ subscriptionStore.currentPlan?.name || 'Не определен' }}
                </span>
              </div>

              <div class="info-item">
                <label>Начало подписки:</label>
                <span>{{ getStartDate() }}</span>
              </div>

              <div class="info-item">
                <label>Окончание подписки:</label>
                <span :class="getExpiryClass()">
                  {{ getExpiryDate() }}
                </span>
              </div>
            </div>
          </div>

          <!-- ===== TAB 2: Личная информация ===== -->
          <div v-if="activeTab === 'personal' && !isAvatarEditMode" class="tab-panel">
            <form @submit.prevent="savePersonalInfo" class="info-form">
              <div class="form-group">
                <label for="username">Имя пользователя:</label>
                <input
                  id="username"
                  v-model="personalForm.username"
                  type="text"
                  placeholder="Введите имя пользователя"
                  maxlength="50"
                />
                <span class="form-hint">Будет отображаться в системе</span>
              </div>

              <div class="form-group">
                <label for="full-name">Полное имя:</label>
                <input
                  id="full-name"
                  v-model="personalForm.full_name"
                  type="text"
                  placeholder="Введите полное имя"
                />
              </div>

              <div class="form-group">
                <label for="phone">Телефон:</label>
                <input
                  id="phone"
                  v-model="personalForm.phone"
                  type="tel"
                  placeholder="+7 (XXX) XXX-XX-XX"
                />
              </div>

              <div class="form-group">
                <label for="city">Город:</label>
                <input
                  id="city"
                  v-model="personalForm.city"
                  type="text"
                  placeholder="Введите город"
                />
              </div>

              <div class="form-group">
                <label for="country">Страна:</label>
                <input
                  id="country"
                  v-model="personalForm.country"
                  type="text"
                  placeholder="Введите страну"
                />
              </div>

              <div class="form-group">
                <label for="office">Представительство:</label>
                <input
                  id="office"
                  v-model="personalForm.office"
                  type="text"
                  placeholder="RUY68"
                  @input="validateOffice"
                  :class="{ 'input-error': officeError }"
                  />
                <div v-if="officeError" class="error-text">{{ officeError }}</div>
              </div>

              <div class="form-group">
                <label
                  for="personal-id-input"
                  :class="{ 'verified-label': user.is_verified }"
                >
                  Компьютерный номер:
                  <span v-if="user.is_verified" class="verified-icon" title="Верифицирован">⭐</span>
                </label>
                <div
                  :class="[
                    'personal-id-input-container',
                    { 'input-error': personalIdError, 'personal-id-input-container--complete': isPersonalIdComplete }
                  ]"
                >
                  <span class="personal-id-prefix">{{ officePrefix }}</span>
                  <input
                    id="personal-id-input"
                    v-model="personalIdSuffix"
                    type="text"
                    placeholder="9 цифр"
                    maxlength="9"
                    @input="updatePersonalId"
                  />
                </div>
                <div v-if="personalIdError" class="error-text">{{ personalIdError }}</div>
                <p class="hint-text">Введите 9 цифр после автоматического префикса</p>
                <p v-if="user.is_verified" class="hint-text hint-text--warning">Изменение номера или представительства приведет к потере статуса верификации.</p>
                <!-- Кнопка верификации и сообщение об отклонении -->
                <div v-if="!user.is_verified" class="verification-section">
                  <button
                    v-if="!verificationStatus.hasPendingRequest"
                    type="button"
                    class="btn-verify"
                    @click="openVerificationModal"
                    :disabled="!canSubmitVerification"
                  >
                    <span class="btn-icon">✓</span>
                    Верифицировать
                  </button>
                  <!-- Подсказка почему кнопка неактивна -->
                  <p v-if="verificationBlockReason && !verificationStatus.hasPendingRequest" class="hint-text hint-text--info">
                    {{ verificationBlockReason }}
                  </p>

                  <div v-else-if="verificationStatus.hasPendingRequest" class="verification-pending-wrapper">
                    <div class="verification-pending">
                      <span class="pending-icon">⏳</span>
                      Заявка на модерации
                    </div>
                    <button
                      type="button"
                      class="btn-cancel-request"
                      @click="openCancelConfirm"
                      :disabled="cancellingVerification"
                    >
                      {{ cancellingVerification ? 'Отмена...' : 'Отменить запрос' }}
                    </button>
                  </div>

                  <!-- Сообщение об отклонении -->
                  <div v-if="verificationStatus.lastRejection" class="rejection-message">
                    <div class="rejection-header">
                      <span class="rejection-icon">❌</span>
                      <strong>Заявка отклонена</strong>
                    </div>
                    <p class="rejection-reason">{{ verificationStatus.lastRejection.rejection_reason }}</p>
                    <p class="rejection-date">
                      {{ formatDate(verificationStatus.lastRejection.processed_at) }}
                    </p>
                  </div>

                  <!-- Сообщение о кулдауне -->
                  <p v-if="!canSubmitVerification && !verificationStatus.hasPendingRequest" class="cooldown-message">
                    {{ cooldownMessage }}
                  </p>
                </div>

                <!-- Кнопка истории верификации -->
                <div v-if="verificationHistory.length > 0 || user.is_verified" class="verification-history-link">
                  <button type="button" class="btn-history" @click="openHistory">
                    📋 История верификации
                  </button>
                </div>
              </div>

              <div v-if="personalError" class="error-message">
                {{ personalError }}
                <!-- Кнопки поддержки для ошибки VERIFIED_BY_OTHER -->
                <div v-if="supportLinks" class="support-links">
                  <a v-if="supportLinks.telegram" :href="supportLinks.telegram" target="_blank" class="support-btn telegram">
                    📞 Telegram
                  </a>
                  <a v-if="supportLinks.email" :href="'mailto:' + supportLinks.email" class="support-btn email">
                    ✉️ {{ supportLinks.email }}
                  </a>
                </div>
              </div>
              <div v-if="personalSuccess" class="success-message">{{ personalSuccess }}</div>

              <button type="submit" class="btn-save" :disabled="savingPersonal">
                {{ savingPersonal ? 'Сохранение...' : '💾 Сохранить изменения' }}
              </button>
            </form>
          </div>

          <!-- ===== TAB 3: Соц. сети ===== -->
          <div v-if="activeTab === 'social' && !isAvatarEditMode" class="tab-panel">
            <form @submit.prevent="saveSocialInfo" class="info-form">
              <div class="form-group">
                <label for="telegram">Telegram (@username):</label>
                <input
                  id="telegram"
                  v-model="socialForm.telegram_user"
                  type="text"
                  placeholder="@username"
                />
              </div>

              <div class="form-group">
                <label for="vk">VK (ссылка):</label>
                <input
                  id="vk"
                  v-model="socialForm.vk_profile"
                  type="text"
                  placeholder="vk.com/username"
                />
              </div>

              <div class="form-group">
                <label for="instagram">Instagram (@username):</label>
                <input
                  id="instagram"
                  v-model="socialForm.instagram_profile"
                  type="text"
                  placeholder="@username"
                />
              </div>

              <div class="form-group">
                <label for="website">Сайт (URL):</label>
                <input
                  id="website"
                  v-model="socialForm.website"
                  type="url"
                  placeholder="https://example.com"
                />
              </div>

              <div v-if="socialError" class="error-message">{{ socialError }}</div>
              <div v-if="socialSuccess" class="success-message">{{ socialSuccess }}</div>

              <button type="submit" class="btn-save" :disabled="savingSocial">
                {{ savingSocial ? 'Сохранение...' : '💾 Сохранить изменения' }}
              </button>
            </form>
          </div>

          <!-- ===== TAB 4: Настройки конфиденциальности ===== -->
          <div v-if="activeTab === 'privacy' && !isAvatarEditMode" class="tab-panel">
            <div class="privacy-settings-main">
              <h3 class="privacy-settings-title">Управление видимостью данных</h3>
              <p class="privacy-settings-hint">
                Настройте, какие данные будут доступны для поиска другим пользователям.
                Разрешенные поля (<svg class="lock-icon-inline lock-icon-inline--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/><path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="white"/></svg>) будут видны в результатах поиска, запрещенные (<svg class="lock-icon-inline lock-icon-inline--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/><path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="white"/></svg>) — скрыты.
              </p>

              <div class="privacy-fields-grid">
                <!-- Личная информация -->
                <div class="privacy-section">
                  <h4 class="privacy-section-title">📋 Личная информация</h4>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Имя пользователя</span>
                      <span class="privacy-field-value">{{ personalForm.username || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.username, 'privacy-toggle-btn--closed': !privacySettings.username }"
                      @click="togglePrivacy('username')"
                    >
                      <svg v-if="privacySettings.username" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.username ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Полное имя</span>
                      <span class="privacy-field-value">{{ personalForm.full_name || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.full_name, 'privacy-toggle-btn--closed': !privacySettings.full_name }"
                      @click="togglePrivacy('full_name')"
                    >
                      <svg v-if="privacySettings.full_name" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.full_name ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Телефон</span>
                      <span class="privacy-field-value">{{ personalForm.phone || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.phone, 'privacy-toggle-btn--closed': !privacySettings.phone }"
                      @click="togglePrivacy('phone')"
                    >
                      <svg v-if="privacySettings.phone" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.phone ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Город</span>
                      <span class="privacy-field-value">{{ personalForm.city || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.city, 'privacy-toggle-btn--closed': !privacySettings.city }"
                      @click="togglePrivacy('city')"
                    >
                      <svg v-if="privacySettings.city" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.city ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Страна</span>
                      <span class="privacy-field-value">{{ personalForm.country || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.country, 'privacy-toggle-btn--closed': !privacySettings.country }"
                      @click="togglePrivacy('country')"
                    >
                      <svg v-if="privacySettings.country" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.country ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Офис</span>
                      <span class="privacy-field-value">{{ personalForm.office || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.office, 'privacy-toggle-btn--closed': !privacySettings.office }"
                      @click="togglePrivacy('office')"
                    >
                      <svg v-if="privacySettings.office" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.office ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Личный ID</span>
                      <span class="privacy-field-value">{{ personalForm.personal_id || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.personal_id, 'privacy-toggle-btn--closed': !privacySettings.personal_id }"
                      @click="togglePrivacy('personal_id')"
                    >
                      <svg v-if="privacySettings.personal_id" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.personal_id ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>
                </div>

                <!-- Социальные сети -->
                <div class="privacy-section">
                  <h4 class="privacy-section-title">🌐 Социальные сети</h4>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Telegram</span>
                      <span class="privacy-field-value">{{ socialForm.telegram_user || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.telegram_user, 'privacy-toggle-btn--closed': !privacySettings.telegram_user }"
                      @click="togglePrivacy('telegram_user')"
                    >
                      <svg v-if="privacySettings.telegram_user" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.telegram_user ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Instagram</span>
                      <span class="privacy-field-value">{{ socialForm.instagram_profile || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.instagram_profile, 'privacy-toggle-btn--closed': !privacySettings.instagram_profile }"
                      @click="togglePrivacy('instagram_profile')"
                    >
                      <svg v-if="privacySettings.instagram_profile" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.instagram_profile ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <!-- VK -->
                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">VK</span>
                      <span class="privacy-field-value">{{ socialForm.vk_profile || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.vk_profile, 'privacy-toggle-btn--closed': !privacySettings.vk_profile }"
                      @click="togglePrivacy('vk_profile')"
                    >
                      <svg v-if="privacySettings.vk_profile" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.vk_profile ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>

                  <!-- Сайт -->
                  <div class="privacy-field-item">
                    <div class="privacy-field-info">
                      <span class="privacy-field-label">Сайт</span>
                      <span class="privacy-field-value">{{ socialForm.website || 'Не указано' }}</span>
                    </div>
                    <button
                      type="button"
                      class="privacy-toggle-btn"
                      :class="{ 'privacy-toggle-btn--open': privacySettings.website, 'privacy-toggle-btn--closed': !privacySettings.website }"
                      @click="togglePrivacy('website')"
                    >
                      <svg v-if="privacySettings.website" class="lock-icon lock-icon--open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#4CAF50" stroke="#2E7D32" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7" stroke="#4CAF50" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <svg v-else class="lock-icon lock-icon--closed" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="5" y="11" width="14" height="10" rx="2" fill="#F44336" stroke="#C62828" stroke-width="1.5"/>
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="16" r="1.5" fill="white"/>
                      </svg>
                      <span class="privacy-toggle-text">{{ privacySettings.website ? 'Разрешен поиск' : 'Запрещен поиск' }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="privacyError" class="error-message">{{ privacyError }}</div>
              <div v-if="privacySuccess" class="success-message">{{ privacySuccess }}</div>

              <button
                type="button"
                class="btn-save btn-privacy"
                :disabled="savingPrivacy"
                @click="savePrivacySettings"
              >
                {{ savingPrivacy ? 'Сохранение...' : '🔒 Сохранить настройки конфиденциальности' }}
              </button>
            </div>
          </div>

          <!-- ===== TAB 5: Безопасность ===== -->
          <div v-if="activeTab === 'security' && !isAvatarEditMode" class="tab-panel">
            <div class="security-section">
              <h3 class="security-title">Смена пароля</h3>
              <p class="security-hint">
                Для повышения безопасности вашего аккаунта рекомендуем использовать надежный пароль длиной не менее 6 символов.
              </p>

              <form @submit.prevent="savePassword" class="info-form security-form">
                <div class="form-group">
                  <label for="current-password">Текущий пароль:</label>
                  <input
                    id="current-password"
                    v-model="securityForm.currentPassword"
                    type="password"
                    placeholder="Введите текущий пароль"
                    autocomplete="current-password"
                    :disabled="savingSecurity"
                  />
                </div>

                <div class="form-group">
                  <label for="new-password">Новый пароль:</label>
                  <input
                    id="new-password"
                    v-model="securityForm.newPassword"
                    type="password"
                    placeholder="Введите новый пароль (мин. 6 символов)"
                    autocomplete="new-password"
                    :class="{ 'input-error': securityForm.newPassword && !isNewPasswordValid }"
                    :disabled="savingSecurity"
                  />
                  <span v-if="securityForm.newPassword && !isNewPasswordValid" class="form-hint form-hint--error">
                    Пароль должен содержать минимум 6 символов
                  </span>
                </div>

                <div class="form-group">
                  <label for="confirm-password">Подтверждение нового пароля:</label>
                  <input
                    id="confirm-password"
                    v-model="securityForm.confirmPassword"
                    type="password"
                    placeholder="Повторите новый пароль"
                    autocomplete="new-password"
                    :class="{ 'input-error': securityForm.confirmPassword && !passwordsMatch }"
                    :disabled="savingSecurity"
                  />
                  <span v-if="securityForm.confirmPassword && !passwordsMatch" class="form-hint form-hint--error">
                    Пароли не совпадают
                  </span>
                </div>

                <div v-if="securityError" class="error-message">{{ securityError }}</div>
                <div v-if="securitySuccess" class="success-message">{{ securitySuccess }}</div>

                <button
                  type="submit"
                  class="btn-save btn-security"
                  :disabled="!isFormFilled || savingSecurity || !passwordsMatch || !isNewPasswordValid"
                >
                  {{ savingSecurity ? 'Сохранение...' : '🔐 Изменить пароль' }}
                </button>
              </form>
            </div>
          </div>

          <!-- ===== TAB 6: Лимиты / Используемые ресурсы ===== -->
          <div v-if="activeTab === 'limits' && !isAvatarEditMode" class="tab-panel">
            <div v-if="imageStatsError" class="limit-error">
              {{ imageStatsError }}
            </div>            
            <div class="limits-grid">
              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">📋</span>
                  <span class="limit-title">Доски</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('boards').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('boards').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('boards').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('boards').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">📝</span>
                  <span class="limit-title">Заметки</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('notes').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('notes').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('notes').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('notes').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">💬</span>
                  <span class="limit-title">Комментарии</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('comments').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('comments').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('comments').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('comments').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">📒</span>
                  <span class="limit-title">Стикеры</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('stickers').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('stickers').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('stickers').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('stickers').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">🎫</span>
                  <span class="limit-title">Лицензии</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getLimitInfo('cards').current }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getLimitInfo('cards').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getLimitInfo('cards').percentage + '%', backgroundColor: getLimitColor(getLimitInfo('cards').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div v-if="imageLibraryStats" class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">🖼️</span>
                  <span class="limit-title">Файлы изображений</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getImageLimitInfo('files').currentDisplay }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getImageLimitInfo('files').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getImageLimitInfo('files').percentage + '%', backgroundColor: getLimitColor(getImageLimitInfo('files').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div v-if="imageLibraryStats" class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">📁</span>
                  <span class="limit-title">Папки</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getImageLimitInfo('folders').currentDisplay }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getImageLimitInfo('folders').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getImageLimitInfo('folders').percentage + '%', backgroundColor: getLimitColor(getImageLimitInfo('folders').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>

              <div v-if="imageLibraryStats" class="limit-card">
                <div class="limit-card-header">
                  <span class="limit-icon">💾</span>
                  <span class="limit-title">Объём хранилища</span>
                </div>
                <div class="limit-card-body">
                  <div class="limit-stats">
                    <span class="limit-current">{{ getImageLimitInfo('storageMB').currentDisplay }}</span>
                    <span class="limit-separator">/</span>
                    <span class="limit-max">{{ getImageLimitInfo('storageMB').maxDisplay }}</span>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: getImageLimitInfo('storageMB').percentage + '%', backgroundColor: getLimitColor(getImageLimitInfo('storageMB').percentage) }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ===== TAB 7: Уведомления ===== -->
          <div v-if="activeTab === 'notifications' && !isAvatarEditMode" class="tab-panel">
            <div class="notifications-section">
              <div class="notification-block">
                <h3 class="notification-title">
                  <span class="notification-icon">💬</span>
                  Telegram
                </h3>
                <TelegramLinkWidget />
              </div>

              <div class="notification-block notification-block--coming-soon">
                <h3 class="notification-title">
                  <span class="notification-icon">🔔</span>
                  Push-уведомления
                </h3>
                <p class="coming-soon-text">Скоро появится</p>
              </div>
            </div>
          </div>

          <!-- ===== TAB 8: Промокод ===== -->
          <div v-if="activeTab === 'promo' && !isAvatarEditMode" class="tab-panel">
            <div class="promo-section">
              <div class="promo-description">
                <p>Введите промокод для получения бонусов или продления подписки:</p>
              </div>
              <div class="promo-input-group">
                <input
                  v-model="promoCodeInput"
                  type="text"
                  placeholder="Введите промокод"
                  class="promo-input"
                  :disabled="applyingPromo"
                />
                <button
                  class="btn-promo"
                  @click="handleApplyPromo"
                  :disabled="!promoCodeInput.trim() || applyingPromo"
                >
                  {{ applyingPromo ? 'Применение...' : 'Применить' }}
                </button>
              </div>

              <div v-if="promoError" class="error-message">{{ promoError }}</div>
              <div v-if="promoSuccess" class="success-message">{{ promoSuccess }}</div>
            </div>
          </div>

          <!-- ===== TAB 9: Тарифы ===== -->
          <div v-if="activeTab === 'tariffs' && !isAvatarEditMode" class="tab-panel">
            <div class="tariffs-section">
              <!-- Текущий тариф -->
              <div class="current-tariff-card">
                <div class="tariff-badge tariff-badge--current">Текущий тариф</div>
                <h3 class="tariff-name">{{ subscriptionStore.currentPlan?.name || 'Не определен' }}</h3>
                <div class="tariff-details">
                  <div class="tariff-detail-item">
                    <span class="detail-label">Начало подписки:</span>
                    <span class="detail-value">{{ getStartDate() }}</span>
                  </div>
                  <div class="tariff-detail-item">
                    <span class="detail-label">Окончание подписки:</span>
                    <span class="detail-value" :class="getExpiryClass()">{{ getExpiryDate() }}</span>
                  </div>
                  <!-- Grace-период -->
                  <div v-if="isInGracePeriod()" class="tariff-detail-item grace-period-warning">
                    <span class="detail-label">⚠️ Льготный период:</span>
                    <span class="detail-value grace-period-date">До {{ getGracePeriodDate() }}</span>
                  </div>
                  <div v-if="isInGracePeriod()" class="grace-period-message">
                    Ваша подписка истекла, но доступ сохранён до окончания льготного периода. Пожалуйста, продлите подписку.
                  </div>
                  <!-- Запланированный тариф -->
                  <div v-if="subscriptionStore.scheduledPlan" class="scheduled-plan-message">
                    <template v-if="subscriptionStore.scheduledPlan.expiresAt">
                      С {{ formatDate(subscriptionStore.currentPlan?.expiresAt) }} вы перейдёте на тариф <strong>{{ subscriptionStore.scheduledPlan.name }}</strong> ({{ getScheduledPlanDays() }} дн.)
                    </template>
                    <template v-else>
                      После окончания подписки вы перейдёте на тариф <strong>{{ subscriptionStore.scheduledPlan.name }}</strong>
                    </template>
                  </div>
                </div>

                <!-- Кнопка продления текущего тарифа -->
                <div
                  v-if="subscriptionStore.currentPlan
                    && subscriptionStore.currentPlan.code_name !== 'guest'
                    && subscriptionStore.currentPlan.code_name !== 'demo'
                    && !subscriptionStore.hasScheduledPlan"
                  class="current-tariff-renewal"
                >
                  <button
                    class="btn-upgrade"
                    :class="{
                      'btn-upgrade--disabled': getPlanButtonState(subscriptionStore.currentPlan).disabled,
                      'btn-upgrade--renew': getPlanButtonState(subscriptionStore.currentPlan).action === 'renew' && !getPlanButtonState(subscriptionStore.currentPlan).disabled
                    }"
                    :disabled="getPlanButtonState(subscriptionStore.currentPlan).disabled"
                    :title="getPlanButtonState(subscriptionStore.currentPlan).tooltip"
                    @click="handleUpgrade(subscriptionStore.currentPlan)"
                  >
                    {{ getPlanButtonState(subscriptionStore.currentPlan).label }}
                  </button>
                </div>

                <!-- Возможности текущего тарифа -->
                <div v-if="Object.keys(subscriptionStore.features).length > 0" class="current-tariff-features">
                  <button
                    class="btn-show-current-features"
                    @click="showCurrentTariffFeatures = !showCurrentTariffFeatures"
                  >
                    {{ showCurrentTariffFeatures ? 'Скрыть возможности ▲' : 'Показать возможности ▼' }}
                  </button>
                  <div v-if="showCurrentTariffFeatures" class="current-features-list">
                    <ul class="tariff-features tariff-features--current">
                      <li
                        v-for="feature in getPrimaryFeatures(subscriptionStore.features)"
                        :key="feature.key"
                        :class="{ 'feature-unavailable': !feature.available }"
                      >
                        <span class="feature-icon">{{ feature.available ? '✓' : '✗' }}</span>
                        {{ feature.label }}
                      </li>
                      <li
                        v-for="feature in getSecondaryFeatures(subscriptionStore.features)"
                        :key="feature.key"
                        :class="{ 'feature-unavailable': !feature.available }"
                      >
                        <span class="feature-icon">{{ feature.available ? '✓' : '✗' }}</span>
                        {{ feature.label }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Доступные тарифы -->
              <div class="available-tariffs">
                <h4 class="tariffs-subtitle">Доступные тарифы</h4>
                <div v-if="loadingPlans" class="tariffs-loading">
                  Загрузка тарифов...
                </div>
                <div v-else-if="availablePlans.length === 0" class="tariffs-empty">
                  Нет доступных тарифов для перехода
                </div>
                <div v-else class="tariffs-grid">
                  <div
                    v-for="plan in availablePlans"
                    :key="plan.id"
                    class="tariff-card"
                    :class="{
                      'tariff-card--recommended': plan.is_featured,
                      'tariff-card--expanded': isPlanExpanded(plan.id)
                    }"
                  >
                    <div v-if="plan.is_featured" class="tariff-recommended-badge">Рекомендуем</div>
                    <h4 class="tariff-card-name">{{ plan.name }}</h4>
                    <p v-if="plan.description" class="tariff-card-description">{{ plan.description }}</p>
                    <p class="tariff-card-price">
                      <span class="price-amount">{{ plan.price_monthly || 0 }}</span>
                      <span class="price-period">₽/мес</span>
                    </p>

                    <!-- Основные функции (всегда видны) -->
                    <ul class="tariff-features tariff-features--primary">
                      <li
                        v-for="feature in getPrimaryFeatures(plan.features)"
                        :key="feature.key"
                        :class="{ 'feature-unavailable': !feature.available }"
                      >
                        <span class="feature-icon">{{ feature.available ? '✓' : '✗' }}</span>
                        {{ feature.label }}
                      </li>
                    </ul>

                    <!-- Кнопка раскрытия дополнительных функций -->
                    <button
                      v-if="getSecondaryFeatures(plan.features).length > 0"
                      class="btn-expand-features"
                      @click="togglePlanExpanded(plan.id)"
                    >
                      <span v-if="isPlanExpanded(plan.id)">Скрыть подробности ▲</span>
                      <span v-else>Подробнее ▼</span>
                    </button>

                    <!-- Дополнительные функции (раскрываются) -->
                    <div v-if="isPlanExpanded(plan.id)" class="tariff-features-expanded">
                      <ul class="tariff-features tariff-features--secondary">
                        <li
                          v-for="feature in getSecondaryFeatures(plan.features)"
                          :key="feature.key"
                          :class="{ 'feature-unavailable': !feature.available }"
                        >
                          <span class="feature-icon">{{ feature.available ? '✓' : '✗' }}</span>
                          {{ feature.label }}
                        </li>
                      </ul>
                    </div>

                    <button
                      v-if="plan.code_name !== 'guest' && plan.code_name !== 'demo' && getPlanButtonState(plan).action !== 'unavailable'"
                      class="btn-upgrade"
                      :class="{
                        'btn-upgrade--disabled': getPlanButtonState(plan).disabled,
                        'btn-upgrade--downgrade': getPlanButtonState(plan).action === 'downgrade' && !getPlanButtonState(plan).disabled,
                        'btn-upgrade--renew': getPlanButtonState(plan).action === 'renew' && !getPlanButtonState(plan).disabled,
                        'btn-upgrade--scheduled': getPlanButtonState(plan).action === 'scheduled'
                      }"
                      :disabled="getPlanButtonState(plan).disabled"
                      :title="getPlanButtonState(plan).tooltip"
                      @click="handleUpgrade(plan)"
                    >
                      {{ getPlanButtonState(plan).label }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ===== Режим редактирования аватара ===== -->
          <div v-if="isAvatarEditMode" class="tab-panel avatar-edit-panel">
            <div class="avatar-editor">
              <h3 class="avatar-editor-title">Редактирование аватара</h3>
              <div class="avatar-preview-large">
                <img
                  v-if="user.avatar_url"
                  :key="avatarKey"
                  :src="getAvatarUrl(user.avatar_url)"
                  alt="Аватар"
                  class="avatar-large-img"
                >
                <div v-else class="avatar-large-placeholder">
                  {{ getInitials(user.username || user.email) }}
                </div>
              </div>
              <div class="avatar-editor-actions">
                <label class="btn-upload-large">
                  <input
                    type="file"
                    accept="image/*"
                    @change="handleAvatarChangeAndClose"
                    style="display: none"
                  >
                  📷 Загрузить фото
                </label>
                <button
                  v-if="user.avatar_url"
                  class="btn-delete-large"
                  @click="handleAvatarDeleteAndClose"
                >
                  🗑️ Удалить фото
                </button>
                <button class="btn-cancel-edit" @click="closeAvatarEdit">
                  ← Назад
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Показываем заглушку, если user еще не загружен -->
    <div v-else class="loading">Загрузка профиля...</div>
  </div>

  <!-- Cropper -->
  <transition name="fade">
    <div
      v-if="showCropper"
      class="cropper-overlay"
    >
      <div class="cropper-modal">
        <div class="cropper-header">
          <h3>Обрезка аватара</h3>
          <button type="button" class="cropper-close" @click="cancelCrop">×</button>
        </div>
        <div class="cropper-body">
          <img
            v-if="selectedImageUrl"
            :src="selectedImageUrl"
            ref="cropperImage"
            alt="Предпросмотр аватара"
            class="cropper-image"
          >
        </div>
        <div class="cropper-footer">
          <button type="button" class="btn-secondary" @click="cancelCrop">
            Отмена
          </button>
          <button
            type="button"
            class="btn-primary"
            :disabled="uploadingAvatar"
            @click="confirmCrop"
          >
            {{ uploadingAvatar ? 'Загрузка...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </transition>
  <!-- Модальное окно отправки заявки на верификацию -->
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="showVerificationModal"
        class="modal-overlay"
        @click.self="closeVerificationModal"
      >
        <div class="verification-modal">
          <div class="verification-modal__header">
            <h3>Заявка на верификацию</h3>
            <button class="modal-close" @click="closeVerificationModal">×</button>
          </div>

          <div class="verification-modal__body">
            <div class="form-group">
              <label for="verification-full-name">Полное имя</label>
              <input
                id="verification-full-name"
                v-model="verificationForm.full_name"
                type="text"
                placeholder="Введите полное ФИО"
              />
            </div>

            <div class="form-group">
              <label for="verification-link">Реферальная ссылка</label>
              <input
                id="verification-link"
                v-model="verificationForm.referral_link"
                type="text"
                placeholder="http://www.fohow.cc/index.php?m=home&c=index&a=index&id=..."
              />
            </div>

            <p class="helper-text">Укажите вашу персональную реферальную ссылку из личного кабинета FOHOW (раздел "Рекомендовать"), содержащую ваш ID. подтвердить компьютерный номер.</p>

            <div v-if="verificationError" class="error-message">{{ verificationError }}</div>
          </div>

          <div class="verification-modal__footer">
            <button class="btn-secondary" type="button" @click="closeVerificationModal">
              Отмена
            </button>
            <button
              class="btn-primary"
              type="button"
              :disabled="submittingVerification"
              @click="submitVerification"
            >
              {{ submittingVerification ? 'Отправка...' : 'Отправить заявку' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Модальное окно предупреждения об отмене верификации -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="showPersonalIdWarning" class="modal-overlay" @click.self="cancelPersonalIdChange">
        <div class="modal-warning">
          <div class="modal-warning-header">
            <h3>ВНИМАНИЕ!</h3>
            <button class="modal-close" @click="cancelPersonalIdChange">×</button>
          </div>
          <div class="modal-warning-body">
            <p>Изменение компьютерного номера или представительства приведет к <strong>потере статуса верификации</strong>.</p>
            <p>Вам придется заново пройти процедуру верификации.</p>
            <p class="modal-warning-question">Вы уверены, что хотите изменить данные?</p>
          </div>
          <div class="modal-warning-actions">
            <button class="btn-cancel" @click="cancelPersonalIdChange">
              Отменить
            </button>
            <button class="btn-confirm-danger" @click="confirmPersonalIdChange">
              Изменить данные
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Модальное окно предупреждения при изменении данных во время pending заявки -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="showPendingWarning" class="modal-overlay" @click.self="cancelPendingChange">
        <div class="modal-warning">
          <div class="modal-warning-header">
            <h3>Заявка на верификации</h3>
            <button class="modal-close" @click="cancelPendingChange">×</button>
          </div>
          <div class="modal-warning-body">
            <p>У вас есть активная заявка на верификацию.</p>
            <p>Изменение представительства или компьютерного номера <strong>отменит текущую заявку</strong>.</p>
          </div>
          <div class="modal-warning-actions">
            <button class="btn-cancel" @click="cancelPendingChange">
              Отменить изменения
            </button>
            <button class="btn-confirm-danger" @click="confirmPendingChange" :disabled="cancellingVerification">
              {{ cancellingVerification ? 'Отмена заявки...' : 'Отменить верификацию' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Модальное окно подтверждения отмены заявки -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="showCancelConfirm" class="modal-overlay" @click.self="closeCancelConfirm">
        <div class="modal-warning">
          <div class="modal-warning-header">
            <h3>Отменить заявку?</h3>
            <button class="modal-close" @click="closeCancelConfirm">×</button>
          </div>
          <div class="modal-warning-body">
            <p>Вы уверены, что хотите отменить заявку на верификацию?</p>
          </div>
          <div class="modal-warning-actions">
            <button class="btn-cancel" @click="closeCancelConfirm">
              Нет, оставить
            </button>
            <button class="btn-confirm-danger" @click="confirmCancelVerification" :disabled="cancellingVerification">
              {{ cancellingVerification ? 'Отмена...' : 'Да, отменить' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Модальное окно истории верификации -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="showHistory" class="modal-overlay" @click.self="closeHistory">
        <div class="modal-history">
          <div class="modal-history-header">
            <h3>История верификации</h3>
            <button class="modal-close" @click="closeHistory">×</button>
          </div>

          <div class="modal-history-body">
            <div v-if="loadingHistory" class="loading-history">
              <div class="spinner-small"></div>
              <p>Загрузка истории...</p>
            </div>

            <div v-else-if="verificationHistory.length === 0" class="empty-history">
              <p>История верификации пуста</p>
            </div>

            <div v-else class="history-list">
              <div
                v-for="item in verificationHistory"
                :key="item.id"
                class="history-item"
                :class="getStatusClass(item.status)"
              >
                <div class="history-item-header">
                  <span class="history-status">{{ getStatusLabel(item.status) }}</span>
                  <span class="history-date">{{ formatDate(item.submitted_at) }}</span>
                </div>

                <div class="history-item-body">
                  <p><strong>ФИО:</strong> {{ item.full_name }}</p>
                  <p><strong>Дата подачи:</strong> {{ formatDate(item.submitted_at) }}</p>

                  <div v-if="item.processed_at">
                    <p><strong>Дата обработки:</strong> {{ formatDate(item.processed_at) }}</p>
                    <p v-if="item.processed_by_username">
                      <strong>Обработал:</strong> {{ item.processed_by_username }}
                    </p>
                  </div>

                  <div v-if="item.status === 'rejected' && item.rejection_reason" class="rejection-reason-history">
                    <strong>Причина отклонения:</strong>
                    <p>{{ item.rejection_reason }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import 'cropperjs/dist/cropper.css'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import TelegramLinkWidget from '@/components/TelegramLinkWidget.vue'

// Composables
import { useUserAvatar } from '@/composables/useUserAvatar'
import { useUserVerification } from '@/composables/useUserVerification'
import { useUserPersonalInfo } from '@/composables/useUserPersonalInfo'
import { useUserSocial } from '@/composables/useUserSocial'
import { useUserPrivacy } from '@/composables/useUserPrivacy'
import { useUserLimits } from '@/composables/useUserLimits'
import { useUserTariffs } from '@/composables/useUserTariffs'
import { useUserPromo } from '@/composables/useUserPromo'
import { useUserSecurity } from '@/composables/useUserSecurity'

const props = defineProps({
  isModernTheme: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'openVerificationModal'])

const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const { user } = storeToRefs(authStore)

const API_URL = import.meta.env.VITE_API_URL || 'https://interactive.marketingfohow.ru/api'

// Табы
const activeTab = ref('basic')
const tabGroups = [
  {
    label: 'Профиль',
    tabs: [
      { id: 'basic', label: 'Основная информация', icon: 'ℹ️' },
      { id: 'personal', label: 'Личная информация', icon: '👤' },
      { id: 'social', label: 'Соц. сети', icon: '🔗' }
    ]
  },
  {
    label: 'Подписка',
    tabs: [
      { id: 'tariffs', label: 'Тарифы', icon: '💳' },
      { id: 'limits', label: 'Лимиты', icon: '📊' },
      { id: 'promo', label: 'Промокод', icon: '🎁' }
    ]
  },
  {
    label: 'Настройки',
    tabs: [
      { id: 'notifications', label: 'Уведомления', icon: '🔔' },
      { id: 'security', label: 'Безопасность', icon: '🛡️' },
      { id: 'privacy', label: 'Настройки конфиденциальности', icon: '👁️' }
    ]
  }
]

// Плоский список табов для совместимости с остальным кодом
const tabs = tabGroups.flatMap(group => group.tabs)

// === Инициализация Composables ===

// Ref-обёртки для функций из useUserVerification
// Нужны для решения циклической зависимости: Personal → cancelVerification → Verification → personalForm → Personal
const cancelVerificationFn = ref(async () => {})
const loadVerificationStatusFn = ref(async () => {})

// Avatar
const {
  avatarKey,
  showCropper,
  selectedImageUrl,
  cropperImage,
  uploadingAvatar,
  isAvatarEditMode,
  getAvatarUrl,
  getInitials,
  handleAvatarChange,
  cancelCrop,
  confirmCrop,
  handleAvatarDelete,
  openAvatarEdit,
  closeAvatarEdit,
  handleAvatarChangeAndClose,
  handleAvatarDeleteAndClose,
  cleanup: cleanupAvatar
} = useUserAvatar({ user, authStore, API_URL })

// Social (нужна форма до Personal для зависимости)
const {
  socialForm,
  socialError,
  socialSuccess,
  savingSocial,
  saveSocialInfo,
  initializeForm: initializeSocialForm
} = useUserSocial({ user, authStore })

// Personal (требует verificationStatus и cancelVerification, поэтому сначала создаём Verification)
// Но Personal нужна personalForm для Verification... Создаём Personal первым без cancelVerification

// Используем временный объект для personalForm
const {
  personalForm,
  officeError,
  personalIdError,
  personalIdSuffix,
  personalError,
  personalSuccess,
  savingPersonal,
  supportLinks,
  showPersonalIdWarning,
  pendingPersonalId,
  pendingOffice,
  showPendingWarning,
  showCancelConfirm,
  cancellingVerification: cancellingVerificationPersonal,
  officePrefix,
  isPersonalIdComplete,
  validateOffice,
  updatePersonalId,
  savePersonalInfo,
  confirmPersonalIdChange,
  cancelPersonalIdChange,
  cancelPendingChange,
  confirmPendingChange,
  openCancelConfirm,
  closeCancelConfirm,
  confirmCancelVerification,
  initializeForm: initializePersonalForm
} = useUserPersonalInfo({
  user,
  authStore,
  verificationStatus: { hasPendingRequest: false }, // Временно, будет обновлено
  cancelVerification: (...args) => cancelVerificationFn.value(...args), // Вызов через ref-обёртку
  loadVerificationStatus: (...args) => loadVerificationStatusFn.value(...args) // Вызов через ref-обёртку
})

// Verification
const {
  verificationStatus,
  showVerificationModal,
  verificationForm,
  verificationError,
  submittingVerification,
  cancellingVerification,
  verificationHistory,
  loadingHistory,
  showHistory,
  cooldownTimeRemaining,
  canSubmitVerification,
  cooldownMessage,
  verificationBlockReason,
  loadVerificationStatus,
  loadVerificationHistory,
  openHistory,
  closeHistory,
  getStatusLabel,
  getStatusClass,
  openVerificationModal,
  closeVerificationModal,
  submitVerification,
  cancelVerification,
  startVerificationCheck,
  cleanup: cleanupVerification
} = useUserVerification({ user, authStore, API_URL , personalForm})

// Обновляем ref-обёртки настоящими функциями из useUserVerification
cancelVerificationFn.value = cancelVerification
loadVerificationStatusFn.value = loadVerificationStatus

// Privacy
const {
  privacySettings,
  privacyError,
  privacySuccess,
  savingPrivacy,
  togglePrivacy,
  savePrivacySettings,
  initializeSettings: initializePrivacySettings
} = useUserPrivacy({ user, authStore, API_URL })

// Limits
const {
  imageLibraryStats,
  imageStatsError,
  getLimitInfo,
  getImageLimitInfo,
  getLimitColor,
  loadImageLibraryStats
} = useUserLimits({ subscriptionStore })

// Tariffs
const {
  loadingPlans,
  availablePlans,
  expandedPlanIds,
  showCurrentTariffFeatures,
  featureLabels,
  formatFeature,
  getPrimaryFeatures,
  getSecondaryFeatures,
  togglePlanExpanded,
  isPlanExpanded,
  loadAvailablePlans,
  getPlanButtonState,
  handleUpgrade
} = useUserTariffs({ subscriptionStore })

// Promo
const {
  promoCodeInput,
  promoError,
  promoSuccess,
  applyingPromo,
  handleApplyPromo
} = useUserPromo({ authStore, subscriptionStore })

// Security
const {
  securityForm,
  securityError,
  securitySuccess,
  savingSecurity,
  isFormFilled,
  passwordsMatch,
  isNewPasswordValid,
  savePassword
} = useUserSecurity({ authStore })

// === Вспомогательные функции ===

// Форматирование даты
function formatDate(dateString) {
  if (!dateString) return 'Не указано'
  const date = new Date(dateString)
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Стиль бейджа плана
function getPlanBadgeStyle() {
  return {
    background: 'linear-gradient(135deg, #ffc107 0%, #e8a900 100%)',
    color: '#000',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '14px',
    display: 'inline-block'
  }
}

// Класс для даты окончания подписки
function getExpiryClass() {
  const expiresAt = user.value?.subscription_expires_at || subscriptionStore.currentPlan?.expiresAt
  if (!expiresAt) return 'expiry-unlimited'

  const daysLeft = subscriptionStore.daysLeft

  if (daysLeft === null) return 'expiry-unlimited'
  if (daysLeft <= 0) return 'expiry-expired'
  if (daysLeft < 7) return 'expiry-warning'
  return 'expiry-active'
}

// Дата начала подписки
function getStartDate() {
  const startDate = user.value?.subscription_started_at || user.value?.created_at
  return formatDate(startDate)
}

// Дата окончания подписки
function getExpiryDate() {
  const expiresAt = user.value?.subscription_expires_at || subscriptionStore.currentPlan?.expiresAt
  if (!expiresAt) return 'Бессрочно'
  return formatDate(expiresAt)
}

// Количество дней для запланированного тарифа
function getScheduledPlanDays() {
  if (!subscriptionStore.scheduledPlan?.expiresAt || !subscriptionStore.currentPlan?.expiresAt) {
    return 0
  }
  const start = new Date(subscriptionStore.currentPlan.expiresAt)
  const end = new Date(subscriptionStore.scheduledPlan.expiresAt)
  const diffTime = end - start
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
}

// Проверка: находится ли пользователь в grace-периоде
function isInGracePeriod() {
  const expiresAt = user.value?.subscription_expires_at
  const gracePeriodUntil = user.value?.grace_period_until

  if (!gracePeriodUntil) return false
  if (!expiresAt) return false

  const now = new Date()
  const graceDate = new Date(gracePeriodUntil)
  const expireDate = new Date(expiresAt)

  return now > expireDate && now <= graceDate
}

// Дата окончания grace-периода
function getGracePeriodDate() {
  const gracePeriodUntil = user.value?.grace_period_until
  if (!gracePeriodUntil) return null
  return formatDate(gracePeriodUntil)
}

// Выбрать таб из бокового меню
function selectTab(tabId) {
  isAvatarEditMode.value = false
  activeTab.value = tabId
}

// === Lifecycle Hooks ===

onMounted(async () => {
  try {
    // Загружаем данные пользователя и план подписки
    await authStore.fetchProfile()
    await subscriptionStore.loadPlan()
    await loadImageLibraryStats()
    await loadVerificationStatus()
  } catch (error) {
    console.error('Ошибка при загрузке данных профиля:', error)
  }

  // Инициализируем формы из composables
  initializePersonalForm()
  initializeSocialForm()
  initializePrivacySettings()

  // Запускаем автоматическую проверку верификации
  startVerificationCheck()
})

onBeforeUnmount(() => {
  cleanupAvatar()
  cleanupVerification()
})

// Загружаем тарифы при переключении на вкладку
watch(activeTab, (newTab) => {
  if (newTab === 'tariffs' && availablePlans.value.length === 0) {
    loadAvailablePlans()
  }
})
</script>

<style scoped>
/* ========================================== */
/* ОСНОВНЫЕ ПЕРЕМЕННЫЕ */
/* ========================================== */
.user-profile {
  position: relative;
  max-width: 800px;
  width: min(800px, calc(100vw - 48px));
  max-height: min(92vh, 720px);
  overflow-y: auto;
  border-radius: 24px;
  padding: 40px 40px 32px;
  box-sizing: border-box;
  background: var(--profile-bg);
  color: var(--profile-text);
  box-shadow: var(--profile-shadow);
  transition: background 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;

  --profile-bg: #ffffff;
  --profile-shadow: 0 32px 64px rgba(15, 23, 42, 0.18);
  --profile-text: #111827;
  --profile-muted: #666666;
  --profile-border: #d1d5db;
  --profile-input-bg: #ffffff;
  --profile-input-border: #d1d5db;
  --profile-input-placeholder: #94a3b8;
  --profile-control-bg: #f1f5f9;
  --profile-control-bg-hover: #e2e8f0;
  --profile-control-text: #2563eb;
  --profile-control-text-hover: #1d4ed8;
  --profile-divider: #e5e7eb;
  --profile-overlay: rgba(0, 0, 0, 0.5);
  --profile-modal-bg: #ffffff;
  --profile-modal-shadow: 0 24px 48px rgba(15, 23, 42, 0.16);
  --profile-error-text: #f44336;
  --profile-error-bg: #ffebee;
  --profile-success-text: #4caf50;
  --profile-success-bg: #e8f5e9;
  --profile-secondary-bg: #f5f5f5;
  --profile-secondary-bg-hover: #e0e0e0;
  --profile-secondary-text: #333333;
  --profile-close-color: #999999;
  --profile-close-color-hover: #333333;
}

.user-profile--modern {
  --profile-bg: rgba(17, 24, 39, 0.95);
  --profile-shadow: 0 40px 70px rgba(2, 6, 23, 0.65);
  --profile-text: #e2e8f0;
  --profile-muted: rgba(148, 163, 184, 0.9);
  --profile-border: rgba(148, 163, 184, 0.35);
  --profile-input-bg: rgba(15, 23, 42, 0.9);
  --profile-input-border: rgba(148, 163, 184, 0.4);
  --profile-input-placeholder: rgba(148, 163, 184, 0.7);
  --profile-control-bg: rgba(30, 41, 59, 0.85);
  --profile-control-bg-hover: rgba(51, 65, 85, 0.95);
  --profile-control-text: #38bdf8;
  --profile-control-text-hover: #0ea5e9;
  --profile-divider: rgba(148, 163, 184, 0.24);
  --profile-overlay: rgba(4, 10, 24, 0.72);
  --profile-modal-bg: rgb(17, 24, 39);
  --profile-modal-shadow: 0 30px 60px rgba(2, 6, 23, 0.6);
  --profile-error-text: #fca5a5;
  --profile-error-bg: rgba(239, 68, 68, 0.18);
  --profile-success-text: #86efac;
  --profile-success-bg: rgba(34, 197, 94, 0.18);
  --profile-secondary-bg: rgba(148, 163, 184, 0.16);
  --profile-secondary-bg-hover: rgba(148, 163, 184, 0.24);
  --profile-secondary-text: #e2e8f0;
  --profile-close-color: rgba(226, 232, 240, 0.6);
  --profile-close-color-hover: #e2e8f0;
}

/* ========================================== */
/* HEADER */
/* ========================================== */
.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.profile-header h2 {
  margin: 0;
  color: var(--profile-text);
  font-size: 28px;
  font-weight: 700;
}

.tariff-btn {
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tariff-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.4);
}

.tariff-btn:active {
  transform: translateY(0);
}

.close-btn {
  background: none;
  border: none;
  font-size: 30px;
  cursor: pointer;
  color: var(--profile-close-color);
  transition: color 0.2s ease;
}

.close-btn:hover {
  color: var(--profile-close-color-hover);
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--profile-muted);
}

/* ========================================== */
/* БЛОК 1: АВАТАРКА */
/* ========================================== */
.profile-avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 30px;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.06) 0%, rgba(232, 169, 0, 0.06) 100%);
  border-radius: 20px;
  margin-bottom: 30px;
  border: 2px solid var(--profile-border);
}
.profile-avatar-section--verified {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(255, 193, 7, 0.12) 100%);
  border-color: rgba(255, 193, 7, 0.45);
  box-shadow: 0 12px 36px rgba(255, 193, 7, 0.2);
}
.avatar-wrapper {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f1f2f6 0%, #d9dce3 100%);
  border: 2px solid rgba(118, 131, 158, 0.2);  
  transition: box-shadow 0.4s ease, transform 0.4s ease, background 0.4s ease, border-color 0.4s ease;
}

.avatar-wrapper--verified {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.35) 0%, rgba(255, 165, 0, 0.35) 100%);
  border: 2px solid rgba(255, 215, 0, 0.55);
  box-shadow: 0 12px 28px rgba(255, 215, 0, 0.25);
  animation: goldPulseProfile 3s ease-in-out infinite;
}

.profile-avatar,
.profile-avatar-placeholder {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid transparent;
  background: linear-gradient(white, white) padding-box,
              linear-gradient(135deg, #ffc107 0%, #e8a900 100%) border-box;
  box-shadow: 0 8px 24px rgba(255, 193, 7, 0.35);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.profile-avatar:hover,
.profile-avatar-placeholder:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(255, 193, 7, 0.4);
}

.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #5a3e00;
  font-size: 48px;
  font-weight: 700;
}
@keyframes goldPulseProfile {
  0% {
    box-shadow: 0 12px 28px rgba(255, 215, 0, 0.22), 0 0 0 0 rgba(255, 215, 0, 0.35);
    border-color: rgba(255, 215, 0, 0.6);
  }
  50% {
    box-shadow: 0 18px 36px rgba(255, 215, 0, 0.35), 0 0 0 12px rgba(255, 215, 0, 0.08);
    border-color: rgba(255, 215, 0, 0.85);
  }
  100% {
    box-shadow: 0 12px 28px rgba(255, 215, 0, 0.22), 0 0 0 0 rgba(255, 215, 0, 0.0);
    border-color: rgba(255, 215, 0, 0.6);
  }
}

.avatar-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-upload,
.btn-remove {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-upload {
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  display: inline-block;
}

.btn-upload:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
}

.btn-remove {
  background: #f44336;
  color: white;
}

.btn-remove:hover {
  background: #da190b;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(244, 67, 54, 0.4);
}

/* ========================================== */
/* ДВУХКОЛОНОЧНЫЙ LAYOUT */
/* ========================================== */
.profile-layout {
  display: flex;
  gap: 24px;
  min-height: 400px;
}

.profile-sidebar {
  flex-shrink: 0;
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-sidebar .profile-avatar-section {
  margin-bottom: 8px;
}

.profile-sidebar .avatar-wrapper {
  width: 100px;
  height: 100px;
  margin: 0 auto;
}

.profile-sidebar .profile-avatar,
.profile-sidebar .profile-avatar-placeholder {
  width: 100px;
  height: 100px;
  font-size: 36px;
}

.profile-sidebar .avatar-hint {
  display: none;
}

/* Боковое меню */
.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-group__divider {
  height: 1px;
  background: var(--profile-border);
  margin: 8px 8px 4px;
  opacity: 0.6;
}

.menu-group__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--profile-muted-text, #94a3b8);
  padding: 4px 14px 2px;
  user-select: none;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--profile-control-bg);
  border: 2px solid var(--profile-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  color: var(--profile-text);
}

.menu-item:hover {
  border-color: rgba(255, 193, 7, 0.8);
  background: #ffc107;
  color: #000000;
  transform: translateX(4px);
}

.menu-item:active {
  background: #e8a900;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  transform: translateX(2px);
  box-shadow: 0 2px 6px rgba(255, 193, 7, 0.2);
}

.menu-item--active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
}

.menu-item--active:hover {
  transform: translateX(4px);
}

.menu-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.menu-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Правая панель контента */
.profile-main {
  flex: 1;
  min-width: 0;
}

.content-area {
  background: var(--profile-control-bg);
  border-radius: 16px;
  padding: 24px;
  min-height: 100%;
  border: 1px solid var(--profile-border);
}

/* ========================================== */
/* БЛОК 2: ТАБЫ (старые стили для совместимости) */
/* ========================================== */
.tabs-container {
  margin-bottom: 30px;
}

.tabs-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 2px solid var(--profile-border);
  border-radius: 16px;
  background: var(--profile-input-bg);
  color: var(--profile-text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-button:hover {
  border-color: rgba(255, 193, 7, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2);
}

.tab-button.active {
  background: #ffc107;
  color: #000000;
  border-color: rgba(255, 193, 7, 0.8);
  box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
}

.tab-icon {
  font-size: 24px;
}

.tab-label {
  text-align: center;
  line-height: 1.3;
}

.tab-content {
  background: var(--profile-control-bg);
  border-radius: 16px;
  padding: 24px;
  min-height: 300px;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================== */
/* TAB 1: ОСНОВНАЯ ИНФОРМАЦИЯ */
/* ========================================== */

/* Grace-период предупреждение */
.grace-warning {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  margin-bottom: 24px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  animation: fadeIn 0.3s ease;
}

.grace-warning-icon {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
}

.grace-warning-content {
  flex: 1;
}

.grace-warning-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #856404;
}

.grace-warning-text {
  margin: 0 0 16px 0;
  font-size: 14px;
  line-height: 1.6;
  color: #856404;
}

.grace-warning-text strong {
  font-weight: 700;
  color: #664d03;
}

.grace-warning-button {
  padding: 10px 20px;
  background-color: #ffc107;
  color: #000;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.grace-warning-button:hover {
  background-color: #ffca2c;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
}

.grace-warning-button:active {
  transform: translateY(0);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item label {
  font-weight: 600;
  color: var(--profile-muted);
  font-size: 14px;
}

.info-item span {
  font-size: 16px;
  color: var(--profile-text);
  font-weight: 500;
}

.plan-badge {
  display: inline-block !important;
}

.expiry-unlimited {
  color: #4caf50;
  font-weight: 600;
}

.expiry-active {
  color: #1b5e20;
  font-weight: 600;
}

.expiry-warning {
  color: #ff9800;
  font-weight: 600;
}

.expiry-expired {
  color: #f44336;
  font-weight: 600;
}

/* ========================================== */
/* TAB 2 & 3: ФОРМЫ */
/* ========================================== */
.info-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.privacy-lock {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  transition: transform 0.2s ease, opacity 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.privacy-lock:hover {
  transform: scale(1.15);
}

.privacy-lock:active {
  transform: scale(0.95);
}

.lock-icon {
  width: 24px;
  height: 24px;
  transition: transform 0.3s ease, filter 0.2s ease;
}

.lock-icon--open {
  filter: drop-shadow(0 2px 4px rgba(76, 175, 80, 0.3));
}

.lock-icon--closed {
  filter: drop-shadow(0 2px 4px rgba(244, 67, 54, 0.3));
}

.privacy-lock:hover .lock-icon {
  filter: brightness(1.1);
}

.lock-icon-inline {
  width: 18px;
  height: 18px;
  vertical-align: middle;
  margin: 0 1px;
}

.lock-icon-inline--open {
  filter: drop-shadow(0 1px 2px rgba(76, 175, 80, 0.3));
}

.lock-icon-inline--closed {
  filter: drop-shadow(0 1px 2px rgba(244, 67, 54, 0.3));
}

.privacy-settings-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--profile-border);
}

.privacy-settings-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--profile-text);
  margin-bottom: 12px;
}

.privacy-settings-hint {
  font-size: 14px;
  color: var(--profile-muted);
  margin-bottom: 20px;
  line-height: 1.5;
}

.btn-privacy {
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-privacy:hover:not(:disabled) {
  background: linear-gradient(135deg, #e8a900 0%, #d49b00 100%);
}

.btn-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.privacy-settings-section--basic {
  margin-top: 24px;
  padding-top: 20px;
}

.form-group label {
  font-weight: 600;
  font-size: 14px;
  color: var(--profile-muted);
}

/* Стили для верифицированного поля "Компьютерный номер" */
.verified-label {
  background: linear-gradient(90deg, #FFD700 0%, #FFA500 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.verified-icon {
  font-size: 16px;
  -webkit-text-fill-color: initial;
}

.verified-input {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.1) 100%);
  border: 2px solid #FFD700;
  font-weight: 600;
}

.verified-input:focus {
  border-color: #FFA500;
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
}

/* Секция верификации */
.verification-section {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-verify {
  padding: 10px 20px;
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.btn-verify:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.btn-verify:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-verify .btn-icon {
  font-size: 18px;
  font-weight: bold;
}

.verification-pending-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: flex-start;
}

.btn-cancel-request {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  background: rgba(244, 67, 54, 0.1);
  color: #F44336;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.btn-cancel-request:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.2);
  transform: translateY(-1px);
}

.btn-cancel-request:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.user-profile--modern .btn-cancel-request {
  background: rgba(244, 67, 54, 0.15);
  color: #EF5350;
}

.user-profile--modern .btn-cancel-request:hover:not(:disabled) {
  background: rgba(244, 67, 54, 0.25);
}

.verification-pending {
  padding: 12px 16px;
  background: rgba(255, 193, 7, 0.1);
  border: 2px solid #FFC107;
  border-radius: 8px;
  color: #F57C00;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
}

.user-profile--modern .verification-pending {
  background: rgba(255, 193, 7, 0.15);
  color: #FFB300;
}

.pending-icon {
  font-size: 18px;
}

.rejection-message {
  padding: 16px;
  background: rgba(244, 67, 54, 0.05);
  border: 2px solid rgba(244, 67, 54, 0.3);
  border-radius: 8px;
  color: var(--profile-text);
}

.user-profile--modern .rejection-message {
  background: rgba(244, 67, 54, 0.1);
  border-color: rgba(244, 67, 54, 0.4);
}

.rejection-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #f44336;
  font-size: 16px;
}

.rejection-icon {
  font-size: 20px;
}

.rejection-reason {
  margin: 8px 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--profile-text);
}

.rejection-date {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--profile-muted);
  font-style: italic;
}

.cooldown-message {
  font-size: 14px;
  color: var(--profile-muted);
  font-style: italic;
  margin: 0;
}

.form-group input {
  padding: 12px 16px;
  border: 2px solid var(--profile-input-border);
  border-radius: 12px;
  font-size: 15px;
  background: var(--profile-input-bg);
  color: var(--profile-text);
  transition: all 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #ffc107;
  box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.15);
}

.form-group input::placeholder {
  color: var(--profile-input-placeholder);
}
.input-error {
  border-color: var(--profile-error-text) !important;
}

.personal-id-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 2px solid var(--profile-input-border);
  border-radius: 12px;
  background: var(--profile-input-bg);
  transition: all 0.3s ease;
}

.personal-id-input-container--complete {
  border-color: #4caf50;
  box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.15);
}

.personal-id-input-container--complete .personal-id-prefix {
  color: #2e7d32;
}

.personal-id-prefix {
  font-weight: 700;
  color: #e8a900;
  font-size: 16px;
  min-width: max-content;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.12) 0%, rgba(232, 169, 0, 0.12) 100%);
  border-radius: 6px;
  padding: 4px 8px;
}

.personal-id-input-container input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--profile-text);
  font-size: 16px;
  padding: 0;
}

.personal-id-input-container input:focus {
  outline: none;
}

.hint-text {
  font-size: 13px;
  color: var(--profile-muted);
  margin: 6px 0 0;
}

.hint-text--warning {
  color: #f57c00;
}

.error-text {
  color: #f44336;
  font-size: 13px;
  margin-top: -4px;
}

.form-hint {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.btn-save {
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.35);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ========================================== */
/* TAB 4: ЛИМИТЫ */
/* ========================================== */
.limits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.limit-error {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(244, 67, 54, 0.2);
  background: rgba(244, 67, 54, 0.08);
  color: #c62828;
  font-weight: 600;
}
.limit-card {
  background: var(--profile-input-bg);
  border: 2px solid var(--profile-border);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
}

.limit-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  border-color: #ffc107;
}

.limit-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.limit-icon {
  font-size: 28px;
}

.limit-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--profile-text);
}

.limit-card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.limit-stats {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 24px;
  font-weight: 700;
}

.limit-current {
  color: #e8a900;
}

.limit-separator {
  color: var(--profile-muted);
  font-size: 18px;
}

.limit-max {
  color: var(--profile-muted);
  font-size: 18px;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: var(--profile-border);
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease, background-color 0.3s ease;
  animation: fillBar 1s ease-out;
}

@keyframes fillBar {
  from {
    width: 0;
  }
}

/* ========================================== */
/* БЛОК 3 & 4: ДОПОЛНИТЕЛЬНЫЕ СЕКЦИИ */
/* ========================================== */
.extra-section {
  margin-bottom: 24px;
  padding: 24px;
  background: var(--profile-control-bg);
  border-radius: 16px;
  border: 2px solid var(--profile-border);
}

.section-header h3 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--profile-text);
}

.promo-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.promo-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.promo-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--profile-input-border);
  border-radius: 12px;
  font-size: 15px;
  background: var(--profile-input-bg);
  color: var(--profile-text);
  transition: all 0.3s ease;
}

.promo-input:focus {
  outline: none;
  border-color: #ffc107;
  box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.15);
}

.promo-input::placeholder {
  color: var(--profile-input-placeholder);
}

.promo-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-promo {
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.35);
}

.btn-promo:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
}

.btn-promo:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* ========================================== */
/* СООБЩЕНИЯ */
/* ========================================== */
.error-message {
  color: var(--profile-error-text);
  font-size: 14px;
  padding: 12px 16px;
  background: var(--profile-error-bg);
  border-radius: 12px;
  font-weight: 500;
}

.support-links {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.support-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}

.support-btn.telegram {
  background: #0088cc;
  color: white;
}

.support-btn.telegram:hover {
  background: #006699;
}

.support-btn.email {
  background: var(--profile-bg-tertiary);
  color: var(--profile-text-primary);
  border: 1px solid var(--profile-border);
}

.support-btn.email:hover {
  background: var(--profile-bg-secondary);
}

.success-message {
  color: var(--profile-success-text);
  font-size: 14px;
  padding: 12px 16px;
  background: var(--profile-success-bg);
  border-radius: 12px;
  font-weight: 500;
}

/* ========================================== */
/* CROPPER MODAL */
/* ========================================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.cropper-overlay {
  position: fixed;
  inset: 0;
  background: var(--profile-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
  box-sizing: border-box;
}

.cropper-modal {
  background: #ffffff;
  color: var(--profile-text);
  padding: 24px;
  border-radius: 20px;
  width: min(520px, 100%);
  box-shadow: var(--profile-modal-shadow);
  display: flex;
  flex-direction: column;
  gap: 16px;
  opacity: 1;
}

.user-profile--modern .cropper-modal {
  background: #111827;
}

.cropper-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.cropper-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.cropper-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  color: var(--profile-close-color);
  transition: color 0.2s ease;
}

.cropper-close:hover {
  color: var(--profile-close-color-hover);
}

.cropper-body {
  position: relative;
  width: 100%;
  max-height: 420px;
  overflow: hidden;
  border-radius: 16px;
  background: var(--profile-control-bg);
}

.cropper-image {
  display: block;
  max-width: 100%;
  width: 100%;
}

.cropper-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
/* ========================================== */
/* ВЕРИФИКАЦИОННОЕ МОДАЛЬНОЕ ОКНО */
/* ========================================== */
.verification-modal {
  background: var(--profile-modal-bg, #ffffff);
  color: var(--profile-text, #111827);
  padding: 22px 24px 20px;
  border-radius: 18px;
  width: min(560px, 100%);
  box-shadow: var(--profile-modal-shadow);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.verification-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.verification-modal__header h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.verification-modal__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 6px;
}

.verification-modal__body label {
  font-weight: 600;
  margin-bottom: 6px;
  display: inline-block;
}

.verification-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 4px;
}

.helper-text {
  margin: 0;
  color: var(--profile-muted, #666666);
  font-size: 14px;
}

.user-profile--modern .verification-modal__header h3 {
  color: var(--profile-text);
}

.btn-primary,
.btn-secondary {
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.35);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: var(--profile-secondary-bg);
  color: var(--profile-secondary-text);
}

.btn-secondary:hover {
  background: var(--profile-secondary-bg-hover);
}

/* ========================================== */
/* RESPONSIVE */
/* ========================================== */
@media (max-width: 768px) {
  .user-profile {
    padding: 24px 20px;
  }

  .profile-header h2 {
    font-size: 24px;
  }

  .tabs-buttons {
    grid-template-columns: repeat(2, 1fr);
  }

  .tab-button {
    padding: 12px 8px;
    font-size: 13px;
  }

  .tab-icon {
    font-size: 20px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .limits-grid {
    grid-template-columns: 1fr;
  }

  .promo-input-group {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-promo {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .profile-avatar,
  .profile-avatar-placeholder {
    width: 120px;
    height: 120px;
  }

  .profile-avatar-placeholder {
    font-size: 36px;
  }

  .avatar-actions {
    flex-direction: column;
    width: 100%;
  }

  .btn-upload,
  .btn-remove {
    width: 100%;
  }

  .tab-content {
    padding: 16px;
  }

  .cropper-modal {
    padding: 20px;
    gap: 12px;
  }

  .cropper-header h3 {
    font-size: 18px;
  }

  .cropper-body {
    max-height: 320px;
  }
}

/* ========================================== */
/* МОДАЛЬНОЕ ОКНО ПРЕДУПРЕЖДЕНИЯ */
/* ========================================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-warning {
  background: #ffffff;
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: modalSlideIn 0.3s ease;
}

.user-profile--modern .modal-warning {
  background: rgba(17, 24, 39, 0.98);
  border: 1px solid rgba(255, 215, 0, 0.3);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-warning-header {
  padding: 24px 24px 16px;
  border-bottom: 2px solid #FFA500;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-warning-header h3 {
  margin: 0;
  font-size: 22px;
  color: #FF6B00;
  font-weight: 700;
}

.user-profile--modern .modal-warning-header h3 {
  color: #FFA500;
}

.modal-close {
  background: none;
  border: none;
  font-size: 32px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #333;
}

.user-profile--modern .modal-close:hover {
  color: #e2e8f0;
}

.modal-warning-body {
  padding: 24px;
}

.modal-warning-body p {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 1.6;
  color: #333;
}

.user-profile--modern .modal-warning-body p {
  color: #e2e8f0;
}

.modal-warning-body strong {
  color: #FF6B00;
  font-weight: 700;
}

.user-profile--modern .modal-warning-body strong {
  color: #FFA500;
}

.modal-warning-question {
  margin-top: 20px;
  font-weight: 600;
  font-size: 17px;
  color: #111;
}

.user-profile--modern .modal-warning-question {
  color: #f1f5f9;
}

.modal-warning-actions {
  padding: 16px 24px 24px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 12px 24px;
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.user-profile--modern .btn-cancel {
  background: rgba(51, 65, 85, 0.9);
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.4);
}

.user-profile--modern .btn-cancel:hover {
  background: rgba(71, 85, 105, 0.95);
}

.btn-confirm-danger {
  padding: 12px 24px;
  background: linear-gradient(135deg, #FF6B00 0%, #FF4500 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
}

.btn-confirm-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 107, 0, 0.4);
}

/* ========================================== */
/* ИСТОРИЯ ВЕРИФИКАЦИИ */
/* ========================================== */
.verification-history-link {
  margin-top: 12px;
}

.btn-history {
  padding: 8px 16px;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-history:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.4);
}

/* Модальное окно истории */
.modal-history {
  background: #ffffff;
  border-radius: 16px;
  max-width: 700px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: modalSlideIn 0.3s ease;
}

.user-profile--modern .modal-history {
  background: rgba(17, 24, 39, 0.98);
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.modal-history-header {
  padding: 24px 24px 16px;
  border-bottom: 2px solid #ffc107;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: #ffffff;
  z-index: 10;
}

.user-profile--modern .modal-history-header {
  background: rgba(17, 24, 39, 0.98);
}

.modal-history-header h3 {
  margin: 0;
  font-size: 20px;
  color: #e8a900;
  font-weight: 700;
}

.user-profile--modern .modal-history-header h3 {
  color: #8b82ff;
}

.modal-history-body {
  padding: 24px;
}

.loading-history {
  text-align: center;
  padding: 40px 20px;
}

.spinner-small {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #ffc107;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-history {
  text-align: center;
  padding: 40px 20px;
  color: var(--profile-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  background: #f5f5f5;
  border-radius: 12px;
  padding: 16px;
  border-left: 4px solid #ccc;
  transition: all 0.2s;
}

.user-profile--modern .history-item {
  background: rgba(30, 41, 59, 0.5);
}

.history-item.status-approved {
  border-left-color: #4CAF50;
  background: rgba(76, 175, 80, 0.05);
}

.user-profile--modern .history-item.status-approved {
  background: rgba(76, 175, 80, 0.1);
}

.history-item.status-rejected {
  border-left-color: #f44336;
  background: rgba(244, 67, 54, 0.05);
}

.user-profile--modern .history-item.status-rejected {
  background: rgba(244, 67, 54, 0.1);
}

.history-item.status-pending {
  border-left-color: #FFC107;
  background: rgba(255, 193, 7, 0.05);
}

.user-profile--modern .history-item.status-pending {
  background: rgba(255, 193, 7, 0.1);
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.user-profile--modern .history-item-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.history-status {
  font-weight: 700;
  font-size: 15px;
}

.history-date {
  font-size: 13px;
  color: var(--profile-muted);
}

.history-item-body p {
  margin: 6px 0;
  font-size: 14px;
  color: var(--profile-text);
}

.history-item-body strong {
  font-weight: 600;
}

.rejection-reason-history {
  margin-top: 12px;
  padding: 12px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  border-left: 3px solid #f44336;
}

.user-profile--modern .rejection-reason-history {
  background: rgba(244, 67, 54, 0.15);
}

.rejection-reason-history strong {
  display: block;
  margin-bottom: 6px;
  color: #f44336;
}

.rejection-reason-history p {
  margin: 0;
  line-height: 1.5;
}

/* ========================================== */
/* Стили для таба "Настройки конфиденциальности" */
/* ========================================== */

.privacy-settings-main {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.privacy-fields-grid {
  display: grid;
  gap: 24px;
}

.privacy-section {
  background: var(--profile-input-bg);
  border: 1px solid var(--profile-border);
  border-radius: 12px;
  padding: 20px;
}

.privacy-section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--profile-text);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.privacy-field-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--profile-border);
}

.privacy-field-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.privacy-field-item:first-child {
  padding-top: 0;
}

.privacy-field-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.privacy-field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--profile-text);
}

.privacy-field-value {
  font-size: 13px;
  color: var(--profile-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.privacy-toggle-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--profile-border);
  background: var(--profile-bg);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.privacy-toggle-btn:hover {
  background: var(--profile-input-bg);
  transform: translateY(-1px);
}

.privacy-toggle-btn--open {
  border-color: #4CAF50;
  color: #2E7D32;
}

.privacy-toggle-btn--closed {
  border-color: #F44336;
  color: #C62828;
}

.privacy-toggle-text {
  white-space: nowrap;
}

/* Адаптация для мобильных */
@media (max-width: 768px) {
  .privacy-field-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .privacy-toggle-btn {
    width: 100%;
    justify-content: center;
  }
}

/* ========================================== */
/* НОВЫЕ СТИЛИ: АВАТАР (КЛИК ДЛЯ РЕДАКТИРОВАНИЯ) */
/* ========================================== */
.avatar-wrapper--clickable {
  cursor: pointer;
  position: relative;
}

.avatar-wrapper--clickable:hover .avatar-edit-overlay {
  opacity: 1;
}

.avatar-edit-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.avatar-edit-icon {
  font-size: 32px;
}

.avatar-hint {
  font-size: 12px;
  color: var(--profile-muted);
  margin-top: 8px;
  text-align: center;
}

/* ========================================== */
/* РЕДАКТОР АВАТАРА */
/* ========================================== */
.avatar-edit-panel {
  display: flex;
  justify-content: center;
}

.avatar-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px;
}

.avatar-editor-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--profile-text);
  margin: 0;
}

.avatar-preview-large {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.6);
  border: 4px solid rgba(255, 215, 0, 0.4);
}

.avatar-large-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-large-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #5a3e00;
  font-size: 64px;
  font-weight: 600;
}

.avatar-editor-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 250px;
}

.btn-upload-large {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-upload-large:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 193, 7, 0.4);
}

.btn-delete-large {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-delete-large:hover {
  background: #c82333;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
}

.btn-cancel-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--profile-control-bg);
  color: var(--profile-text);
  border: 1px solid var(--profile-border);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel-edit:hover {
  background: var(--profile-control-bg-hover);
}

/* ========================================== */
/* РАЗДЕЛ УВЕДОМЛЕНИЯ */
/* ========================================== */
.notifications-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.notification-block {
  padding: 20px;
  background: var(--profile-control-bg);
  border-radius: 12px;
  border: 1px solid var(--profile-border);
}

.notification-block--coming-soon {
  opacity: 0.7;
}

.notification-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--profile-text);
  margin: 0 0 16px 0;
}

.notification-icon {
  font-size: 24px;
}

.coming-soon-text {
  color: var(--profile-muted);
  font-style: italic;
  font-size: 14px;
  margin: 0;
  padding: 12px;
  background: var(--profile-bg);
  border-radius: 8px;
  text-align: center;
}

/* ========================================== */
/* РАЗДЕЛ ПРОМОКОД (обновлённые стили) */
/* ========================================== */
.promo-description {
  margin-bottom: 16px;
}

.promo-description p {
  color: var(--profile-muted);
  font-size: 14px;
  margin: 0;
}

/* ========================================== */
/* РАЗДЕЛ ТАРИФЫ */
/* ========================================== */
.tariffs-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.current-tariff-card {
  position: relative;
  padding: 24px;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  border-radius: 16px;
  color: #000;
}

.tariff-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.12);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
}

.tariff-name {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.tariff-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tariff-detail-item {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.detail-label {
  opacity: 0.8;
}

.detail-value {
  font-weight: 600;
}

/* Grace-период стили */
.grace-period-warning {
  background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid #ff9800;
  margin-top: 8px;
}

.grace-period-warning .detail-label {
  color: #e67e22;
  font-weight: 600;
  opacity: 1;
}

.grace-period-date {
  color: #d35400;
  font-weight: 700;
}

.grace-period-message {
  background: #fff3cd;
  color: #856404;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  margin-top: 8px;
  border: 1px solid #ffeaa7;
}

/* Кнопка продления в карточке текущего тарифа */
.current-tariff-renewal {
  margin-top: 16px;
}

.current-tariff-renewal .btn-upgrade {
  width: 100%;
}

.current-tariff-renewal .btn-upgrade--disabled {
  background: rgba(0, 0, 0, 0.2) !important;
  color: rgba(0, 0, 0, 0.6);
}

/* Запланированный тариф */
.scheduled-plan-info {
  background: #fef3c7;
  border-radius: 8px;
  padding: 8px 12px;
}

.scheduled-plan-name {
  color: #92400e;
  font-weight: 600;
}

.scheduled-plan-message {
  font-size: 13px;
  color: #92400e;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  padding: 8px 12px;
  margin-top: 8px;
  border-radius: 4px;
  line-height: 1.5;
}

/* Заблокированная кнопка */
.btn-upgrade--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #9ca3af !important;
}

.btn-upgrade--disabled:hover {
  transform: none;
  box-shadow: none;
}

/* Кнопка даунгрейда */
.btn-upgrade--downgrade {
  background: #f59e0b !important;
}

.btn-upgrade--downgrade:hover {
  background: #d97706 !important;
}

/* Кнопка продления */
.btn-upgrade--renew {
  background: #10b981 !important;
}

.btn-upgrade--renew:hover {
  background: #059669 !important;
}

/* Запланированный тариф (кнопка) */
.btn-upgrade--scheduled {
  background: #6b7280 !important;
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-upgrade--scheduled:hover {
  transform: none;
  box-shadow: none;
}

.available-tariffs {
  padding: 20px;
  background: var(--profile-control-bg);
  border-radius: 16px;
}

.tariffs-subtitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--profile-text);
  margin: 0 0 16px 0;
}

.tariffs-loading,
.tariffs-empty {
  padding: 24px;
  text-align: center;
  color: var(--profile-muted);
  font-size: 14px;
}

.tariffs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.tariff-card {
  position: relative;
  padding: 20px;
  background: var(--profile-bg);
  border: 2px solid var(--profile-border);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.tariff-card:hover {
  border-color: #ffc107;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(255, 193, 7, 0.25);
}

.tariff-card--recommended {
  border-color: #ffc107;
}

.tariff-recommended-badge {
  position: absolute;
  top: -10px;
  right: 12px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  font-size: 11px;
  font-weight: 600;
  border-radius: 12px;
}

.tariff-card-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--profile-text);
  margin: 0 0 8px 0;
}

.tariff-card-price {
  margin: 0 0 12px 0;
}

.price-amount {
  font-size: 28px;
  font-weight: 700;
  color: #e8a900;
}

.price-period {
  font-size: 14px;
  color: var(--profile-muted);
}

.tariff-features {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
}

.tariff-card-description {
  font-size: 12px;
  color: var(--profile-muted);
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.tariff-features li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
  color: var(--profile-text);
}

.tariff-features li .feature-icon {
  flex-shrink: 0;
  color: #4CAF50;
  font-weight: 600;
}

.tariff-features li.feature-unavailable {
  color: var(--profile-muted);
  text-decoration: line-through;
}

.tariff-features li.feature-unavailable .feature-icon {
  color: #e74c3c;
}

.tariff-features--primary {
  margin-bottom: 8px;
}

.tariff-features--secondary {
  margin-bottom: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--profile-border);
}

.btn-expand-features {
  width: 100%;
  padding: 6px 12px;
  margin-bottom: 12px;
  background: transparent;
  border: 1px solid var(--profile-border);
  border-radius: 6px;
  color: var(--profile-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-expand-features:hover {
  border-color: #ffc107;
  color: #e8a900;
}

.tariff-features-expanded {
  animation: expandFeatures 0.3s ease;
}

@keyframes expandFeatures {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

.tariff-card--expanded {
  background: var(--profile-control-bg);
}

/* Стили для возможностей текущего тарифа */
.current-tariff-features {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.btn-show-current-features {
  width: 100%;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  color: #000;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-show-current-features:hover {
  background: rgba(0, 0, 0, 0.15);
}

.current-features-list {
  margin-top: 12px;
  animation: expandFeatures 0.3s ease;
}

.tariff-features--current li {
  color: rgba(0, 0, 0, 0.85);
}

.tariff-features--current li .feature-icon {
  color: #2e7d32;
}

.tariff-features--current li.feature-unavailable {
  color: rgba(0, 0, 0, 0.4);
}

.tariff-features--current li.feature-unavailable .feature-icon {
  color: #c62828;
}

.btn-upgrade {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #ffc107 0%, #e8a900 100%);
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-upgrade:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.4);
}

/* ========================================== */
/* АДАПТИВНЫЕ СТИЛИ ДЛЯ ДВУХКОЛОНОЧНОГО LAYOUT */
/* ========================================== */
@media (max-width: 768px) {
  .profile-layout {
    flex-direction: column;
  }

  .profile-sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .profile-sidebar .profile-avatar-section {
    margin-bottom: 0;
  }

  .sidebar-menu {
    flex-direction: row;
    flex-wrap: wrap;
    flex: 1;
    gap: 8px;
  }

  .menu-group {
    display: contents;
  }

  .menu-group__divider,
  .menu-group__label {
    display: none;
  }

  .menu-item {
    padding: 8px 12px;
    font-size: 12px;
  }

  .menu-icon {
    font-size: 16px;
  }

  .content-area {
    padding: 16px;
  }

  .avatar-preview-large {
    width: 150px;
    height: 150px;
  }

  .avatar-large-placeholder {
    font-size: 48px;
  }

  .tariffs-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .profile-sidebar {
    flex-direction: column;
    align-items: stretch;
  }

  .profile-sidebar .profile-avatar-section {
    align-self: center;
  }

  .sidebar-menu {
    flex-direction: column;
  }

  .menu-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .menu-group__divider,
  .menu-group__label {
    display: block;
  }

  .menu-item {
    padding: 10px 14px;
    font-size: 13px;
  }

  .menu-item:hover {
    transform: none;
  }

  .menu-item--active:hover {
    transform: none;
  }
}
</style>
