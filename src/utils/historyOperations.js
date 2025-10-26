import { useCardsStore } from '../stores/cards';
import { useConnectionsStore } from '../stores/connections';
import { useHistoryStore } from '../stores/history';

/**
 * Вспомогательные функции для групповых операций с историей
 */

/**
 * Выполняет групповую операцию с сохранением состояния в историю
 * @param {Function} operation - Функция операции
 * @param {string} actionType - Тип действия
 * @param {string} actionDescription - Описание действия
 */
export function executeGroupOperation(operation, actionType, actionDescription) {
  const historyStore = useHistoryStore();
  
  try {
    // Устанавливаем метаданные для операции
    historyStore.setActionMetadata(actionType, actionDescription);
    
    // Выполняем операцию
    const result = operation();
    
    // Сохраняем состояние в историю
    historyStore.saveState();
    
    return result;
  } catch (error) {
    console.error('Ошибка при выполнении групповой операции:', error);
    throw error;
  }
}

/**
 * Создает пакет операций для перемещения нескольких карточек
 * @param {Array} updates - Массив обновлений { cardId, x, y }
 */
export function batchMoveCards(updates) {
  return executeGroupOperation(
    () => {
      const cardsStore = useCardsStore();
      return cardsStore.updateMultipleCardsPositions(updates);
    },
    'update',
    `Перемещено ${updates.length} карточек`
  );
}

/**
 * Создает пакет операций для удаления нескольких карточек
 * @param {Array} cardIds - Массив ID карточек для удаления
 */
export function batchDeleteCards(cardIds) {
  return executeGroupOperation(
    () => {
      const cardsStore = useCardsStore();
      const connectionsStore = useConnectionsStore();
      
      // Сначала удаляем все соединения, связанные с карточками
      cardIds.forEach(cardId => {
        connectionsStore.removeConnectionsByCardId(cardId);
      });
      
      // Затем удаляем сами карточки
      const deletedCards = [];
      cardIds.forEach(cardId => {
        const index = cardsStore.cards.findIndex(c => c.id === cardId);
        if (index !== -1) {
          deletedCards.push(cardsStore.cards[index]);
          cardsStore.cards.splice(index, 1);
        }
      });
      
      return deletedCards;
    },
    'delete',
    `Удалено ${cardIds.length} карточек`
  );
}

/**
 * Создает пакет операций для удаления нескольких соединений
 * @param {Array} connectionIds - Массив ID соединений для удаления
 */
export function batchDeleteConnections(connectionIds) {
  return executeGroupOperation(
    () => {
      const connectionsStore = useConnectionsStore();
      return connectionsStore.removeMultipleConnections(connectionIds);
    },
    'delete',
    `Удалено ${connectionIds.length} соединений`
  );
}

/**
 * Создает пакет операций для изменения свойств нескольких карточек
 * @param {Array} updates - Массив обновлений { cardId, properties }
 */
export function batchUpdateCards(updates) {
  return executeGroupOperation(
    () => {
      const cardsStore = useCardsStore();
      const updatedCards = [];
      
      updates.forEach(({ cardId, properties }) => {
        const card = cardsStore.cards.find(c => c.id === cardId);
        if (card) {
          Object.assign(card, properties);
          updatedCards.push(card);
        }
      });
      
      return updatedCards;
    },
    'update',
    `Изменено ${updates.length} карточек`
  );
}

/**
 * Создает пакет операций для создания нескольких карточек
 * @param {Array} cardsData - Массив данных для новых карточек
 */
export function batchCreateCards(cardsData) {
  return executeGroupOperation(
    () => {
      const cardsStore = useCardsStore();
      const newCards = [];
      
      cardsData.forEach(cardData => {
        const newCard = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          x: cardData.x || 0,
          y: cardData.y || 0,
          text: cardData.text || '',
          width: cardData.width || 150,
          height: cardData.height || 80,
          fill: cardData.fill || '#4CAF50',
          stroke: cardData.stroke || '#2E7D32',
          strokeWidth: cardData.strokeWidth || 2
        };
        
        cardsStore.cards.push(newCard);
        newCards.push(newCard);
      });
      
      return newCards;
    },
    'create',
    `Создано ${cardsData.length} карточек`
  );
}

/**
 * Создает пакет операций для создания нескольких соединений
 * @param {Array} connectionsData - Массив данных для новых соединений { fromCardId, toCardId }
 */
export function batchCreateConnections(connectionsData) {
  return executeGroupOperation(
    () => {
      const connectionsStore = useConnectionsStore();
      const newConnections = [];
      
      connectionsData.forEach(({ fromCardId, toCardId }) => {
        // Проверяем, что соединение еще не существует
        const existingConnection = connectionsStore.connections.find(
          conn => (conn.from === fromCardId && conn.to === toCardId) || 
                  (conn.from === toCardId && conn.to === fromCardId)
        );
        
        if (!existingConnection) {
          const newConnection = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            from: fromCardId,
            to: toCardId
          };
          
          connectionsStore.connections.push(newConnection);
          newConnections.push(newConnection);
        }
      });
      
      return newConnections;
    },
    'create',
    `Создано ${newConnections.length} соединений`
  );
}

/**
 * Отключает автоматическое сохранение в историю для выполнения серии операций
 * @param {Function} operations - Функция с серией операций
 * @param {string} actionType - Тип действия для итогового сохранения
 * @param {string} actionDescription - Описание действия для итогового сохранения
 */
export function withHistoryBatch(operations, actionType, actionDescription) {
  const historyStore = useHistoryStore();
  
  // Временно отключаем автоматическое сохранение
  const originalSaveState = historyStore.saveState;
  historyStore.saveState = () => {}; // Пустая функция
  
  try {
    // Выполняем серию операций
    const result = operations();
    
    // Восстанавливаем функцию сохранения
    historyStore.saveState = originalSaveState;
    
    // Сохраняем конечное состояние с указанными метаданными
    historyStore.setActionMetadata(actionType, actionDescription);
    historyStore.saveState();
    
    return result;
  } catch (error) {
    // Восстанавливаем функцию сохранения при ошибке
    historyStore.saveState = originalSaveState;
    console.error('Ошибка при выполнении пакетной операции:', error);
    throw error;
  }
}