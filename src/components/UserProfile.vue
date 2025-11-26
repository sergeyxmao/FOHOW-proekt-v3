<template>
  <div
    :class="[
      'user-profile',
      { 'user-profile--modern': props.isModernTheme }
    ]"
  >
    <div class="profile-header">
      <h2>Мой профиль</h2>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <!-- Показываем основной контент ТОЛЬКО ЕСЛИ объект user существует и загружен -->
    <div v-if="user" class="profile-content">
      <!-- ============================================ -->
      <!-- Блок 1: Аватарка (верх страницы, по центру) -->
      <!-- ============================================ -->
      <div
        class="profile-avatar-section"
        :class="{ 'profile-avatar-section--verified': user.is_verified }"
      >          <div :class="['avatar-wrapper', { 'avatar-wrapper--verified': user.is_verified }]">
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
          </div>
          <div class="avatar-actions">
            <label class="btn-upload">
              <input
              type="file"
              accept="image/*"
              @change="handleAvatarChange"
              style="display: none"
            >
            📷 Загрузить фото
          </label>
          <button
            v-if="user.avatar_url"
            class="btn-remove"
            @click="handleAvatarDelete"
          >
            🗑️ Удалить фото
          </button>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- Блок 2: Табы с информацией (4 кнопки в ряд) -->
      <!-- ============================================ -->
      <div class="tabs-container">
        <div class="tabs-buttons">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-button', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <div class="tab-content">
          <!-- ===== TAB 1: Основная информация ===== -->
          <div v-if="activeTab === 'basic'" class="tab-panel">
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
          <div v-if="activeTab === 'personal'" class="tab-panel">
            <form @submit.prevent="savePersonalInfo" class="info-form">
              <div class="form-group">
                <div class="form-group-header">
                  <label for="username">Имя пользователя:</label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.username, 'privacy-lock--closed': !privacySettings.username }"
                    @click="togglePrivacy('username')"
                    :title="privacySettings.username ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
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
                <div class="form-group-header">
                  <label for="phone">Телефон:</label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.phone, 'privacy-lock--closed': !privacySettings.phone }"
                    @click="togglePrivacy('phone')"
                    :title="privacySettings.phone ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
                <input
                  id="phone"
                  v-model="personalForm.phone"
                  type="tel"
                  placeholder="+7 (XXX) XXX-XX-XX"
                />
              </div>

              <div class="form-group">
                <div class="form-group-header">
                  <label for="city">Город:</label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.city, 'privacy-lock--closed': !privacySettings.city }"
                    @click="togglePrivacy('city')"
                    :title="privacySettings.city ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
                <input
                  id="city"
                  v-model="personalForm.city"
                  type="text"
                  placeholder="Введите город"
                />
              </div>

              <div class="form-group">
                <div class="form-group-header">
                  <label for="country">Страна:</label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.country, 'privacy-lock--closed': !privacySettings.country }"
                    @click="togglePrivacy('country')"
                    :title="privacySettings.country ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
                <input
                  id="country"
                  v-model="personalForm.country"
                  type="text"
                  placeholder="Введите страну"
                />
              </div>

              <div class="form-group">
                <div class="form-group-header">
                  <label for="office">Представительство:</label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.office, 'privacy-lock--closed': !privacySettings.office }"
                    @click="togglePrivacy('office')"
                    :title="privacySettings.office ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
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
                <div class="form-group-header">
                  <label
                    for="personal-id-input"
                    :class="{ 'verified-label': user.is_verified }"
                  >
                    Компьютерный номер:
                    <span v-if="user.is_verified" class="verified-icon" title="Верифицирован">⭐</span>
                  </label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.personal_id, 'privacy-lock--closed': !privacySettings.personal_id }"
                    @click="togglePrivacy('personal_id')"
                    :title="privacySettings.personal_id ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
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

                  <div v-else class="verification-pending-wrapper">
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

              <div v-if="personalError" class="error-message">{{ personalError }}</div>
              <div v-if="personalSuccess" class="success-message">{{ personalSuccess }}</div>

              <button type="submit" class="btn-save" :disabled="savingPersonal">
                {{ savingPersonal ? 'Сохранение...' : '💾 Сохранить изменения' }}
              </button>
            </form>

            <!-- Секция настроек конфиденциальности -->
            <div class="privacy-settings-section">
              <h3 class="privacy-settings-title">Настройки конфиденциальности</h3>
              <p class="privacy-settings-hint">
                Нажмите на замок рядом с любым полем, чтобы разрешить или запретить поиск по этому полю
              </p>

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

          <!-- ===== TAB 3: Соц. сети ===== -->
          <div v-if="activeTab === 'social'" class="tab-panel">
            <form @submit.prevent="saveSocialInfo" class="info-form">
              <div class="form-group">
                <div class="form-group-header">
                  <label for="telegram">Telegram (@username):</label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.telegram_user, 'privacy-lock--closed': !privacySettings.telegram_user }"
                    @click="togglePrivacy('telegram_user')"
                    :title="privacySettings.telegram_user ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
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
                <div class="form-group-header">
                  <label for="instagram">Instagram (@username):</label>
                  <button
                    type="button"
                    class="privacy-lock"
                    :class="{ 'privacy-lock--open': privacySettings.instagram_profile, 'privacy-lock--closed': !privacySettings.instagram_profile }"
                    @click="togglePrivacy('instagram_profile')"
                    :title="privacySettings.instagram_profile ? 'Поиск разрешен' : 'Поиск запрещен'"
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
                  </button>
                </div>
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

            <!-- Секция настроек конфиденциальности -->
            <div class="privacy-settings-section">
              <h3 class="privacy-settings-title">Настройки конфиденциальности</h3>
              <p class="privacy-settings-hint">
                Нажмите на замок рядом с любым полем, чтобы разрешить или запретить поиск по этому полю
              </p>

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

          <!-- ===== TAB 4: Лимиты / Используемые ресурсы ===== -->
          <div v-if="activeTab === 'limits'" class="tab-panel">
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
                  <span class="limit-icon">🎨</span>
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
                  <span class="limit-title">Карточки</span>
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
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- Блок 3: Telegram интеграция -->
      <!-- ============================================ -->
      <div class="extra-section">
        <div class="section-header">
          <h3>Уведомления Telegram</h3>
        </div>
        <TelegramLinkWidget />
      </div>

      <!-- ============================================ -->
      <!-- Блок 4: Промокоды -->
      <!-- ============================================ -->
      <div class="extra-section">
        <div class="section-header">
          <h3>Промокод</h3>
        </div>
        <div class="promo-section">
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
              <label for="verification-shot-1">Скриншот 1 (JPG/PNG, до 5MB)</label>
              <input
                id="verification-shot-1"
                type="file"
                accept="image/jpeg,image/png"
                @change="(event) => handleScreenshotChange(event, 1)"
              />
            </div>

            <div class="form-group">
              <label for="verification-shot-2">Скриншот 2 (JPG/PNG, до 5MB)</label>
              <input
                id="verification-shot-2"
                type="file"
                accept="image/jpeg,image/png"
                @change="(event) => handleScreenshotChange(event, 2)"
              />
            </div>

            <p class="helper-text">Загрузите скриншоты кабинета FOHOW, чтобы подтвердить компьютерный номер.</p>

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
import { ref, reactive, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import TelegramLinkWidget from '@/components/TelegramLinkWidget.vue'

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

// Аватарка
const avatarKey = ref(0) // Ключ для принудительной перерисовки аватарки
const showCropper = ref(false)
const selectedImageUrl = ref('')
const cropperImage = ref(null)
let cropper = null
const uploadingAvatar = ref(false)

// Табы
const activeTab = ref('basic')
const tabs = [
  { id: 'basic', label: 'Основная информация', icon: 'ℹ️' },
  { id: 'personal', label: 'Личная информация', icon: '👤' },
  { id: 'social', label: 'Соц. сети', icon: '🌐' },
  { id: 'limits', label: 'Лимиты', icon: '📊' }
]

// Формы
const personalForm = reactive({
  username: '',
  full_name: '',
  phone: '',
  city: '',
  country: '',
  office: '',
  personal_id: ''
})
const officeError = ref('')
const personalIdError = ref('')
const personalIdSuffix = ref('')
const socialForm = reactive({
  telegram_user: '',
  vk_profile: '',
  instagram_profile: '',
  website: ''
})

const personalError = ref('')
const personalSuccess = ref('')
const savingPersonal = ref(false)

const socialError = ref('')
const socialSuccess = ref('')
const savingSocial = ref(false)

// Настройки конфиденциальности
const privacySettings = ref({
  username: false,
  phone: false,
  city: false,
  country: false,
  office: false,
  personal_id: false,
  telegram_user: false,
  instagram_profile: false
})

const privacyError = ref('')
const privacySuccess = ref('')
const savingPrivacy = ref(false)

// Промокод
const promoCodeInput = ref('')
const promoError = ref('')
const promoSuccess = ref('')
const applyingPromo = ref(false)

// Предупреждение об изменении компьютерного номера
const showPersonalIdWarning = ref(false)
const pendingPersonalId = ref('')
const pendingOffice = ref('')

// Предупреждение при изменении данных во время pending заявки
const showPendingWarning = ref(false)
const cancellingVerification = ref(false)

// Подтверждение отмены заявки на верификацию
const showCancelConfirm = ref(false)

// Статус верификации
const verificationStatus = reactive({
  isVerified: false,
  hasPendingRequest: false,
  lastRejection: null,
  lastAttempt: null,
  cooldownUntil: null
})

const showVerificationModal = ref(false)

// Форма верификации
const verificationForm = reactive({
  full_name: '',
  screenshot_1: null,
  screenshot_2: null
})

const verificationError = ref('')
const submittingVerification = ref(false)

// Интервал автоматической проверки статуса верификации
let verificationCheckInterval = null

// Интервал обновления таймера кулдауна
let cooldownTimerInterval = null

// Оставшееся время кулдауна (форматированная строка)
const cooldownTimeRemaining = ref('')

// История верификации
const verificationHistory = ref([])
const loadingHistory = ref(false)
const showHistory = ref(false)
const OFFICE_PATTERN = /^[A-Z]{3}\d{2,3}$/

const officePrefix = computed(() => personalForm.office.trim().toUpperCase())

const isPersonalIdComplete = computed(() => {
  const suffix = personalIdSuffix.value.replace(/\D/g, '')
  return OFFICE_PATTERN.test(officePrefix.value) && suffix.length === 9
})

// Вычисляемые свойства для верификации
const canSubmitVerification = computed(() => {
  // Нельзя подать заявку, если уже есть ожидающая
  if (verificationStatus.hasPendingRequest) return false

  // Нельзя подать заявку, если не указан компьютерный номер
  if (!personalForm.personal_id || !personalForm.personal_id.trim()) return false

  // Нельзя подать заявку, если действует кулдаун
  if (verificationStatus.cooldownUntil) {
    const now = new Date()
    const cooldownEnd = new Date(verificationStatus.cooldownUntil)
    if (now < cooldownEnd) return false
  }

  return true
})

const cooldownMessage = computed(() => {
  if (!verificationStatus.cooldownUntil) return ''

  const now = new Date()
  const cooldownEnd = new Date(verificationStatus.cooldownUntil)

  if (now >= cooldownEnd) return ''

  // Если есть точное оставшееся время, показать его
  if (cooldownTimeRemaining.value) {
    return `Повторная заявка доступна через ${cooldownTimeRemaining.value}`
  }

  // Fallback на часы/дни (если таймер ещё не запущен)
  const diffMs = cooldownEnd - now
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays > 1) {
    return `Повторная заявка доступна через ${diffDays} дн.`
  } else if (diffHours > 1) {
    return `Повторная заявка доступна через ${diffHours} ч.`
  } else {
    return 'Повторная заявка скоро будет доступна'
  }
})

// Обновление таймера обратного отсчёта кулдауна
function updateCooldownTime() {
  const endTime = verificationStatus.cooldownUntil

  if (!endTime) {
    cooldownTimeRemaining.value = ''
    return
  }

  const now = new Date()
  const end = new Date(endTime)
  const diff = end - now

  if (diff <= 0) {
    cooldownTimeRemaining.value = ''
    // Очистить интервал
    if (cooldownTimerInterval) {
      clearInterval(cooldownTimerInterval)
      cooldownTimerInterval = null
    }
    // Перезагрузить статус
    loadVerificationStatus()
    return
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (hours > 0) {
    cooldownTimeRemaining.value = `${hours}ч ${minutes}м ${seconds}с`
  } else if (minutes > 0) {
    cooldownTimeRemaining.value = `${minutes}м ${seconds}с`
  } else {
    cooldownTimeRemaining.value = `${seconds}с`
  }
}

// Запустить таймер кулдауна
function startCooldownTimer() {
  // Очистить предыдущий интервал
  if (cooldownTimerInterval) {
    clearInterval(cooldownTimerInterval)
  }

  // Запустить обновление каждую секунду
  cooldownTimerInterval = setInterval(updateCooldownTime, 1000)
  // Сразу обновить
  updateCooldownTime()
}
function normalizeOffice(value) {
  return (value || '').trim().toUpperCase()
}

function validateOffice() {
  const office = normalizeOffice(personalForm.office)
  personalForm.office = office

  if (!office) {
    officeError.value = ''
    personalIdError.value = ''
    updatePersonalId(false)
    return true
  }

  if (!OFFICE_PATTERN.test(office)) {
    officeError.value = 'Представительство должно быть в формате: 3 английские буквы + 2-3 цифры (например: RUY68)'
    personalIdError.value = officeError.value
    return false
  }

  officeError.value = ''
  updatePersonalId()
  return true
}

function updatePersonalId(showOfficeValidation = true) {
  const office = normalizeOffice(personalForm.office)
  personalForm.office = office

  const digitsOnly = personalIdSuffix.value.replace(/\D/g, '')
  if (digitsOnly !== personalIdSuffix.value) {
    personalIdSuffix.value = digitsOnly
  }

  if (personalIdSuffix.value.length > 9) {
    personalIdSuffix.value = personalIdSuffix.value.slice(0, 9)
  }

  const suffix = personalIdSuffix.value
  personalForm.personal_id = office + suffix

  if (!office) {
    personalIdError.value = showOfficeValidation ? 'Укажите представительство' : ''
    return
  }

  if (!OFFICE_PATTERN.test(office)) {
    personalIdError.value = showOfficeValidation ? (officeError.value || 'Некорректный формат представительства') : ''
    return
  }

  if (suffix.length === 9) {
    personalIdError.value = ''
  } else {
    personalIdError.value = `Введено ${suffix.length}/9 цифр`
  }
}

function validatePersonalId() {
  const isOfficeValid = validateOffice()
  const office = officePrefix.value
  const suffix = personalIdSuffix.value.replace(/\D/g, '')

  if (!office) {
    personalIdError.value = 'Укажите представительство'
    return false
  }

  if (!isOfficeValid) {
    personalIdError.value = officeError.value
    return false
  }

  if (suffix.length !== 9) {
    personalIdError.value = `Введено ${suffix.length}/9 цифр`
    return false
  }

  personalForm.personal_id = office + suffix
  personalIdError.value = ''
  return true
}

function initializePersonalIdFields() {
  personalForm.office = normalizeOffice(personalForm.office)
  const existingPersonalId = (personalForm.personal_id || '').trim()
  let suffix = ''

  if (existingPersonalId && officePrefix.value && existingPersonalId.startsWith(officePrefix.value)) {
    suffix = existingPersonalId.slice(officePrefix.value.length)
  } else if (existingPersonalId) {
    const match = existingPersonalId.match(/^([A-Z]{3}\d{2,3})(\d{0,9})/)
    if (match) {
      personalForm.office = match[1]
      suffix = match[2]
    }
  }

  personalIdSuffix.value = (suffix || '').replace(/\D/g, '').slice(0, 9)
  updatePersonalId(false)
}
// Инициализация
onMounted(async () => {
  // Принудительно загружаем свежие данные пользователя и план подписки
  try {
    // Загружаем профиль пользователя с актуальными данными
    await authStore.fetchProfile()
    // Загружаем план подписки
    await subscriptionStore.loadPlan()
    // Загружаем статус верификации
    await loadVerificationStatus()
  } catch (error) {
    console.error('Ошибка при загрузке данных профиля:', error)
  }

  // Заполняем формы текущими данными
  if (user.value) {
    personalForm.username = user.value.username || ''
    personalForm.full_name = user.value.full_name || ''
    personalForm.phone = user.value.phone || ''
    personalForm.city = user.value.city || ''
    personalForm.country = user.value.country || ''
    personalForm.office = user.value.office || ''
    personalForm.personal_id = user.value.personal_id || ''
    initializePersonalIdFields()

    socialForm.telegram_user = user.value.telegram_user || ''
    socialForm.vk_profile = user.value.vk_profile || ''
    socialForm.instagram_profile = user.value.instagram_profile || ''
    socialForm.website = user.value.website || ''

    // Инициализируем настройки конфиденциальности
    if (user.value.search_settings) {
      privacySettings.value = {
        username: user.value.search_settings.username || false,
        phone: user.value.search_settings.phone || false,
        city: user.value.search_settings.city || false,
        country: user.value.search_settings.country || false,
        office: user.value.search_settings.office || false,
        personal_id: user.value.search_settings.personal_id || false,
        telegram_user: user.value.search_settings.telegram_user || false,
        instagram_profile: user.value.search_settings.instagram_profile || false
      }
    }
  }

  // Автоматически проверять статус верификации каждые 10 секунд (если есть pending заявка)
  verificationCheckInterval = setInterval(async () => {
    if (verificationStatus.hasPendingRequest) {
      await loadVerificationStatus()
    }
  }, 10000) // 10 секунд
})

onBeforeUnmount(() => {
  cancelCrop()

  // Очистить интервал автоматической проверки статуса верификации
  if (verificationCheckInterval) {
    clearInterval(verificationCheckInterval)
    verificationCheckInterval = null
  }

  // Очистить интервал таймера кулдауна
  if (cooldownTimerInterval) {
    clearInterval(cooldownTimerInterval)
    cooldownTimerInterval = null
  }
})

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

// Получить URL аватара
function getAvatarUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_URL.replace('/api', '')}${url}`
}

// Получить инициалы
function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Стиль бейджа плана
function getPlanBadgeStyle() {
  return {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '14px',
    display: 'inline-block'
  }
}

// Класс для даты окончания подписки
function getExpiryClass() {
  // Проверяем сначала user.subscription_expires_at, затем subscriptionStore
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
  // Используем subscription_started_at, если есть, иначе created_at
  const startDate = user.value?.subscription_started_at || user.value?.created_at
  return formatDate(startDate)
}

// Дата окончания подписки
function getExpiryDate() {
  // Проверяем сначала user.subscription_expires_at, затем subscriptionStore
  const expiresAt = user.value?.subscription_expires_at || subscriptionStore.currentPlan?.expiresAt
  if (!expiresAt) return 'Бессрочно'
  return formatDate(expiresAt)
}

// Информация о лимитах
function getLimitInfo(resourceType) {
  const limitData = subscriptionStore.checkLimit(resourceType)
  const maxDisplay = limitData.max === -1 ? '∞' : limitData.max
  const percentage = limitData.max === -1 ? 0 : Math.min(100, Math.round((limitData.current / limitData.max) * 100))

  return {
    current: limitData.current,
    max: limitData.max,
    maxDisplay,
    percentage
  }
}

// Цвет прогресс-бара
function getLimitColor(percentage) {
  if (percentage < 70) return '#4caf50' // Зелёный
  if (percentage < 90) return '#ffc107' // Оранжевый
  return '#f44336' // Красный
}


// Загрузка статуса верификации
async function loadVerificationStatus() {
  try {
    const response = await fetch(`${API_URL}/verification/status`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()

      // Если статус верификации изменился, обновить профиль пользователя
      if (data.isVerified !== user.value.is_verified) {
        await authStore.fetchProfile()
      }

      verificationStatus.isVerified = data.isVerified || false
      verificationStatus.hasPendingRequest = data.hasPendingRequest || false
      verificationStatus.lastRejection = data.lastRejection || null
      verificationStatus.lastAttempt = data.lastAttempt || null
      verificationStatus.cooldownUntil = data.cooldownUntil || null

      // Запустить таймер обратного отсчёта, если есть активный кулдаун
      if (data.cooldownUntil) {
        startCooldownTimer()
      } else {
        // Очистить таймер если кулдаун закончился
        if (cooldownTimerInterval) {
          clearInterval(cooldownTimerInterval)
          cooldownTimerInterval = null
        }
        cooldownTimeRemaining.value = ''
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки статуса верификации:', error)
  }
}

// Функция загрузки истории верификации
async function loadVerificationHistory() {
  loadingHistory.value = true

  try {
    const response = await fetch(`${API_URL}/verification/history`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('Ошибка загрузки истории')
    }

    const data = await response.json()
    verificationHistory.value = data.history || []
  } catch (err) {
    console.error('Ошибка загрузки истории верификации:', err)
  } finally {
    loadingHistory.value = false
  }
}

// Открыть историю верификации
function openHistory() {
  showHistory.value = true
  loadVerificationHistory()
}

// Закрыть историю верификации
function closeHistory() {
  showHistory.value = false
}

// Функция получения метки статуса
function getStatusLabel(status) {
  const labels = {
    'pending': '⏳ На модерации',
    'approved': '✅ Одобрено',
    'rejected': '❌ Отклонено'
  }
  return labels[status] || status
}

// Функция получения класса статуса
function getStatusClass(status) {
  return `status-${status}`
}

// Открыть модальное окно верификации
function openVerificationModal() {
  if (!canSubmitVerification.value) {
    return
  }

  // Предзаполнить ФИО из профиля
  verificationForm.full_name = user.value.full_name || ''
  verificationForm.screenshot_1 = null
  verificationForm.screenshot_2 = null
  verificationError.value = ''

  showVerificationModal.value = true
}

// Закрыть модальное окно верификации
function closeVerificationModal() {
  showVerificationModal.value = false
  verificationForm.full_name = ''
  verificationForm.screenshot_1 = null
  verificationForm.screenshot_2 = null
  verificationError.value = ''
}

// Обработка выбора файла
function handleScreenshotChange(event, screenshotNumber) {
  const file = event.target.files[0]

  if (!file) {
    return
  }

  // Валидация типа файла
  if (!file.type.match(/^image\/(jpeg|png)$/)) {
    verificationError.value = 'Допустимы только файлы JPG и PNG'
    event.target.value = ''
    return
  }

  // Валидация размера файла (5MB)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    verificationError.value = `Файл ${screenshotNumber === 1 ? '1' : '2'} превышает максимальный размер 5MB`
    event.target.value = ''
    return
  }

  if (screenshotNumber === 1) {
    verificationForm.screenshot_1 = file
  } else {
    verificationForm.screenshot_2 = file
  }

  verificationError.value = ''
}

// Отправить заявку на верификацию
async function submitVerification() {
  verificationError.value = ''

  // Валидация формы
  if (!verificationForm.full_name.trim()) {
    verificationError.value = 'Введите полное ФИО'
    return
  }

  if (!verificationForm.screenshot_1) {
    verificationError.value = 'Загрузите первый скриншот'
    return
  }

  if (!verificationForm.screenshot_2) {
    verificationError.value = 'Загрузите второй скриншот'
    return
  }

  submittingVerification.value = true

  try {
    const formData = new FormData()
    formData.append('full_name', verificationForm.full_name.trim())
    formData.append('screenshot_1', verificationForm.screenshot_1)
    formData.append('screenshot_2', verificationForm.screenshot_2)

    const response = await fetch(`${API_URL}/verification/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка отправки заявки')
    }

    // Закрыть модальное окно
    closeVerificationModal()

    // Обновить статус верификации
    await loadVerificationStatus()

    // Показать успешное уведомление
    alert('Заявка на верификацию отправлена! Ожидайте проверки администратором.')

  } catch (err) {
    verificationError.value = err.message || 'Не удалось отправить заявку. Попробуйте позже.'
  } finally {
    submittingVerification.value = false
  }
}

// Сохранить личную информацию
async function savePersonalInfo() {
  personalError.value = ''
  personalSuccess.value = ''
  if (!validatePersonalId()) {
    personalError.value = personalIdError.value || 'Проверьте корректность представительства и компьютерного номера'
    return
  }

  // Проверяем, изменились ли критические поля (office или personal_id)
  const officeChanged = personalForm.office &&
    personalForm.office.trim().toUpperCase() !== (user.value.office || '').trim().toUpperCase()
  const personalIdChanged = personalForm.personal_id &&
    personalForm.personal_id.trim() !== '' &&
    personalForm.personal_id !== user.value.personal_id

  // ПРОВЕРКА 1: Если есть pending заявка и изменяются критические поля
  if (verificationStatus.hasPendingRequest && (officeChanged || personalIdChanged)) {
    // Показать предупреждение о pending заявке
    showPendingWarning.value = true
    pendingPersonalId.value = personalForm.personal_id
    pendingOffice.value = personalForm.office
    return // Остановить выполнение до подтверждения
  }

  // ПРОВЕРКА 2: Проверка изменения номера/офиса для верифицированных пользователей
  if (user.value.is_verified && (officeChanged || personalIdChanged)) {
    // Открыть модальное окно предупреждения
    showPersonalIdWarning.value = true
    pendingPersonalId.value = personalForm.personal_id
    pendingOffice.value = personalForm.office
    return // Остановить выполнение до подтверждения
  }

  // Если предупреждение не нужно, продолжить обычное сохранение
  savingPersonal.value = true

  try {
    await authStore.updateProfile({
      username: personalForm.username,
      full_name: personalForm.full_name,
      phone: personalForm.phone,
      city: personalForm.city,
      country: personalForm.country,
      office: personalForm.office,
      personal_id: personalForm.personal_id
    })

    personalSuccess.value = 'Личная информация успешно обновлена!'

    setTimeout(() => {
      personalSuccess.value = ''
    }, 3000)
  } catch (err) {
    personalError.value = err.message || 'Произошла ошибка при сохранении'
  } finally {
    savingPersonal.value = false
  }
}

// Подтвердить изменение компьютерного номера
function confirmPersonalIdChange() {
  showPersonalIdWarning.value = false
  // Продолжить сохранение с новым номером
  savePersonalInfoConfirmed()
}

// Отменить изменение компьютерного номера
function cancelPersonalIdChange() {
  showPersonalIdWarning.value = false
  // Вернуть старые значения
  personalForm.personal_id = user.value.personal_id || ''
  personalForm.office = user.value.office || ''
  pendingPersonalId.value = ''
  pendingOffice.value = ''
  // Обновить суффикс
  if (user.value.personal_id && user.value.office) {
    personalIdSuffix.value = user.value.personal_id.replace(user.value.office.toUpperCase(), '')
  }
}

// Сохранить личную информацию после подтверждения
async function savePersonalInfoConfirmed() {
  savingPersonal.value = true
  personalError.value = ''
  personalSuccess.value = ''

  try {
    await authStore.updateProfile({
      username: personalForm.username,
      full_name: personalForm.full_name,
      phone: personalForm.phone,
      city: personalForm.city,
      country: personalForm.country,
      office: pendingOffice.value || personalForm.office,
      personal_id: pendingPersonalId.value || personalForm.personal_id
    })

    personalSuccess.value = 'Личная информация обновлена. Верификация отменена.'

    setTimeout(() => {
      personalSuccess.value = ''
    }, 3000)
  } catch (err) {
    personalError.value = err.message || 'Произошла ошибка при сохранении'
  } finally {
    savingPersonal.value = false
    pendingPersonalId.value = ''
    pendingOffice.value = ''
  }
}

// === Функции для работы с pending заявками ===

// Отменить изменения при pending заявке
function cancelPendingChange() {
  showPendingWarning.value = false
  // Вернуть старые значения
  personalForm.personal_id = user.value.personal_id || ''
  personalForm.office = user.value.office || ''
  pendingPersonalId.value = ''
  pendingOffice.value = ''
  // Обновить суффикс
  if (user.value.personal_id && user.value.office) {
    personalIdSuffix.value = user.value.personal_id.replace(user.value.office.toUpperCase(), '')
  }
}

// Подтвердить изменения и отменить pending заявку
async function confirmPendingChange() {
  cancellingVerification.value = true
  try {
    // Отменить заявку на верификацию
    await cancelVerification()

    // Закрыть модальное окно
    showPendingWarning.value = false

    // Продолжить сохранение с новыми данными
    savingPersonal.value = true

    await authStore.updateProfile({
      username: personalForm.username,
      full_name: personalForm.full_name,
      phone: personalForm.phone,
      city: personalForm.city,
      country: personalForm.country,
      office: pendingOffice.value || personalForm.office,
      personal_id: pendingPersonalId.value || personalForm.personal_id
    })

    personalSuccess.value = 'Заявка на верификацию отменена. Данные обновлены.'

    setTimeout(() => {
      personalSuccess.value = ''
    }, 3000)
  } catch (err) {
    personalError.value = err.message || 'Произошла ошибка'
  } finally {
    cancellingVerification.value = false
    savingPersonal.value = false
    pendingPersonalId.value = ''
    pendingOffice.value = ''
  }
}

// Открыть подтверждение отмены заявки
function openCancelConfirm() {
  showCancelConfirm.value = true
}

// Закрыть подтверждение отмены заявки
function closeCancelConfirm() {
  showCancelConfirm.value = false
}

// Подтвердить отмену заявки
async function confirmCancelVerification() {
  cancellingVerification.value = true
  try {
    await cancelVerification()
    showCancelConfirm.value = false
    personalSuccess.value = 'Заявка на верификацию отменена.'
    setTimeout(() => {
      personalSuccess.value = ''
    }, 3000)
  } catch (err) {
    personalError.value = err.message || 'Не удалось отменить заявку'
  } finally {
    cancellingVerification.value = false
  }
}

// Отменить заявку на верификацию
async function cancelVerification() {
  const token = localStorage.getItem('token')
  if (!token) {
    throw new Error('Необходима авторизация')
  }

  const response = await fetch(`${API_URL}/verification/cancel`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Ошибка отмены заявки')
  }

  // Обновить статус верификации
  await loadVerificationStatus()

  return true
}

// Сохранить соц. сети
async function saveSocialInfo() {
  socialError.value = ''
  socialSuccess.value = ''
  savingSocial.value = true

  try {
    const profileData = {
      telegram_user: socialForm.telegram_user?.trim() || '',
      vk_profile: socialForm.vk_profile?.trim() || '',
      instagram_profile: socialForm.instagram_profile?.trim() || '',
      website: socialForm.website?.trim() || ''
    }

    await authStore.updateProfile(profileData)
    socialSuccess.value = 'Социальные сети успешно обновлены!'

    setTimeout(() => {
      socialSuccess.value = ''
    }, 3000)
  } catch (err) {
    socialError.value = err.message || 'Произошла ошибка при сохранении'
  } finally {
    savingSocial.value = false
  }
}

// Переключить настройку конфиденциальности
function togglePrivacy(field) {
  privacySettings.value[field] = !privacySettings.value[field]
}

// Сохранить настройки конфиденциальности
async function savePrivacySettings() {
  privacyError.value = ''
  privacySuccess.value = ''
  savingPrivacy.value = true

  try {
    const response = await fetch(`${API_URL}/profile/privacy`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ search_settings: privacySettings.value })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Ошибка сохранения настроек')
    }

    const result = await response.json()

    // Обновляем search_settings в authStore
    if (user.value) {
      user.value.search_settings = result.search_settings
    }

    privacySuccess.value = 'Настройки конфиденциальности успешно сохранены!'

    setTimeout(() => {
      privacySuccess.value = ''
    }, 3000)
  } catch (err) {
    privacyError.value = err.message || 'Произошла ошибка при сохранении'
  } finally {
    savingPrivacy.value = false
  }
}

// Применить промокод
async function handleApplyPromo() {
  promoError.value = ''
  promoSuccess.value = ''

  const code = promoCodeInput.value.trim()

  if (!code) {
    promoError.value = 'Введите промокод'
    return
  }

  applyingPromo.value = true

  try {
    await authStore.applyPromoCode(code)
    promoSuccess.value = 'Промокод успешно применен!'
    promoCodeInput.value = ''

    // Обновляем план подписки
    await subscriptionStore.loadPlan()

    setTimeout(() => {
      promoSuccess.value = ''
    }, 5000)
  } catch (err) {
    promoError.value = err.message || 'Ошибка применения промокода'
  } finally {
    applyingPromo.value = false
  }
}

// Загрузка аватара
async function handleAvatarChange(event) {
  const file = event.target.files[0]
  if (!file) return

  selectedImageUrl.value = URL.createObjectURL(file)
  showCropper.value = true

  await nextTick()

  if (cropper) {
    cropper.destroy()
  }

  cropper = new Cropper(cropperImage.value, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 1,
    responsive: true,
    background: false
  })
}

// Отмена обрезки
function cancelCrop() {
  if (cropper) {
    cropper.destroy()
    cropper = null
  }
  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value)
    selectedImageUrl.value = ''
  }
  showCropper.value = false
}

// Подтверждение обрезки и загрузка
async function confirmCrop() {
  if (!cropper) return

  uploadingAvatar.value = true

  try {
    const canvas = cropper.getCroppedCanvas({
      width: 400,
      height: 400,
      imageSmoothingQuality: 'high'
    })

    canvas.toBlob(async (blob) => {
      if (!blob) {
        throw new Error('Ошибка создания изображения')
      }

      const formData = new FormData()
      formData.append('avatar', blob, 'avatar.jpg')

      const response = await fetch(`${API_URL}/profile/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки')
      }

      // ИСПРАВЛЕНИЕ БАГА: Обновляем аватар и увеличиваем ключ для перерисовки
      user.value.avatar_url = data.avatar_url
      authStore.user.avatar_url = data.avatar_url
      localStorage.setItem('user', JSON.stringify(authStore.user))

      // Увеличиваем ключ для принудительной перерисовки аватарки
      avatarKey.value++

      alert('Аватар успешно обновлен!')
      cancelCrop()
    }, 'image/jpeg', 0.95)
  } catch (err) {
    alert(err.message || 'Ошибка загрузки аватара')
  } finally {
    uploadingAvatar.value = false
  }
}

// Удаление аватара
async function handleAvatarDelete() {
  if (!confirm('Вы уверены, что хотите удалить аватар?')) return

  try {
    const response = await fetch(`${API_URL}/profile/avatar`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Ошибка удаления аватара')
    }

    // Обновляем аватар и увеличиваем ключ для перерисовки
    user.value.avatar_url = null
    authStore.user.avatar_url = null
    localStorage.setItem('user', JSON.stringify(authStore.user))

    avatarKey.value++

    alert('Аватар успешно удален!')
  } catch (err) {
    alert(err.message || 'Ошибка удаления аватара')
  }
}
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
  --profile-modal-bg: rgba(17, 24, 39, 0.96);
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
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
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
              linear-gradient(135deg, #667eea 0%, #764ba2 100%) border-box;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.profile-avatar:hover,
.profile-avatar-placeholder:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: inline-block;
}

.btn-upload:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
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
/* БЛОК 2: ТАБЫ */
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
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.tab-button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
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
  color: #4caf50;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-privacy:hover:not(:disabled) {
  background: linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%);
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
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
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
  color: #667eea;
  font-size: 16px;
  min-width: max-content;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
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
  border-color: #667eea;
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
  color: #667eea;
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
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-promo:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
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
  background: var(--profile-modal-bg);
  color: var(--profile-text);
  padding: 24px;
  border-radius: 20px;
  width: min(520px, 100%);
  box-shadow: var(--profile-modal-shadow);
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.verification-modal__body .form-group input[type="file"] {
  padding: 10px;
  background: var(--profile-input-bg, #ffffff);
  border: 1px solid var(--profile-input-border, #d1d5db);
  border-radius: 12px;
  color: var(--profile-text);
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

.user-profile--modern .verification-modal__body .form-group input[type="file"] {
  background: var(--profile-input-bg);
  border-color: var(--profile-input-border);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
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
  background: linear-gradient(135deg, #6c63ff 0%, #5848ff 100%);
  color: #ffffff;
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
  box-shadow: 0 4px 12px rgba(108, 99, 255, 0.3);
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
  border-bottom: 2px solid #6c63ff;
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
  color: #6c63ff;
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
  border-top: 3px solid #6c63ff;
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
</style>
