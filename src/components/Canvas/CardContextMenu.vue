<script setup>
import { ref, computed } from 'vue';
import { useCardsStore } from '../../stores/cards';

const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  position: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close']);

const cardsStore = useCardsStore();

// Обработчики для значков
const toggleSlfBadge = () => {
  cardsStore.updateCard(props.card.id, {
    showSlfBadge: !props.card.showSlfBadge
  });
};

const toggleFendouBadge = () => {
  cardsStore.updateCard(props.card.id, {
    showFendouBadge: !props.card.showFendouBadge
  });
};

const setRankBadge = (rank) => {
  cardsStore.updateCard(props.card.id, {
    rankBadge: rank === props.card.rankBadge ? null : rank
  });
};

const clearAllBadges = () => {
  cardsStore.updateCard(props.card.id, {
    showSlfBadge: false,
    showFendouBadge: false,
    rankBadge: null
  });
};

// Обработчики для размера
const toggleSize = () => {
  const newWidth = props.card.width >= 494 ? 380 : 494;
  cardsStore.updateCard(props.card.id, {
    width: newWidth
  });
};

// Закрытие меню при клике вне его
const handleClickOutside = () => {
  emit('close');
};
</script>

<template>
  <div 
    class="context-menu-overlay"
    @click="handleClickOutside"
    @contextmenu.prevent
  >
    <div
      class="card-context-menu"
      :style="{
        left: position.x + 'px',
        top: position.y + 'px'
      }"
      @click.stop
    >
      <!-- Секция: Значки -->
      <div class="context-menu-section">
        <div class="context-menu-header">Значки</div>
        
        <div 
          class="context-menu-item"
          :class="{ active: card.showSlfBadge }"
          @click="toggleSlfBadge"
        >
          <span class="menu-icon">⭐</span>
          <span>SLF значок</span>
        </div>
        
        <div 
          class="context-menu-item"
          :class="{ active: card.showFendouBadge }"
          @click="toggleFendouBadge"
        >
          <span class="menu-icon">🔥</span>
          <span>Fendou (奋斗)</span>
        </div>
      </div>

      <!-- Секция: Ранговые значки -->
      <div class="context-menu-section">
        <div class="context-menu-header">Ранг</div>
        
        <div 
          v-for="rank in ['1', '2', '3', '4', '5', '6']"
          :key="rank"
          class="context-menu-item"
          :class="{ active: card.rankBadge === rank }"
          @click="setRankBadge(rank)"
        >
          <span class="menu-icon">🏆</span>
          <span>Ранг {{ rank }}</span>
        </div>
        
        <div 
          class="context-menu-item context-menu-item--danger"
          @click="clearAllBadges"
        >
          <span class="menu-icon">🗑️</span>
          <span>Убрать все значки</span>
        </div>
      </div>

      <!-- Секция: Размер -->
      <div class="context-menu-section">
        <div class="context-menu-header">Размер</div>
        
        <div 
          class="context-menu-item"
          @click="toggleSize"
        >
          <span class="menu-icon">{{ card.width >= 494 ? '📐' : '📏' }}</span>
          <span>{{ card.width >= 494 ? 'Обычный размер' : 'Большой размер' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
}

.card-context-menu {
  position: fixed;
  z-index: 10000;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  padding: 6px;
  min-width: 220px;
  max-width: 280px;
}

.context-menu-section {
  border-bottom: 1px solid #f3f4f6;
  padding: 6px 0;
}

.context-menu-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.context-menu-section:first-child {
  padding-top: 0;
}

.context-menu-header {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  padding: 6px 12px;
  margin-bottom: 4px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.context-menu-item:hover {
  background-color: #f3f4f6;
}

.context-menu-item.active {
  background-color: #dbeafe;
  color: #1e40af;
  font-weight: 600;
}

.context-menu-item.active .menu-icon {
  transform: scale(1.1);
}

.context-menu-item--danger {
  color: #dc2626;
}

.context-menu-item--danger:hover {
  background-color: #fee2e2;
}

.menu-icon {
  font-size: 18px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}
</style>
