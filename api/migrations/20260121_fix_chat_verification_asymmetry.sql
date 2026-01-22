-- Миграция: Исправление асимметричной видимости чатов между верифицированными и неверифицированными пользователями
-- Дата: 2026-01-21
-- Описание: Обеспечить симметричную видимость сообщений в чатах
-- ============================================
-- Проблема: Если неверифицированный пользователь пишет верифицированному,
-- верифицированный не видит сообщения и саму переписку.
-- Решение: Убедиться, что get_or_create_private_chat функция не применяет
-- верификацию как фильтр для создания или видимости чатов
-- ============================================

-- DROP and recreate the get_or_create_private_chat function
-- to ensure symmetric communication between verified and unverified users
DROP FUNCTION IF EXISTS get_or_create_private_chat(bigint, bigint) CASCADE;

CREATE FUNCTION get_or_create_private_chat(user_id_1 bigint, user_id_2 bigint)
RETURNS bigint AS $$
DECLARE
  chat_id_result bigint;
BEGIN
  -- Ensure user_id_1 < user_id_2 for consistency
  IF user_id_1 > user_id_2 THEN
    user_id_1 := user_id_1 ^ user_id_2;
    user_id_2 := user_id_1 ^ user_id_2;
    user_id_1 := user_id_1 ^ user_id_2;
  END IF;
  
  -- Look for existing chat
  SELECT c.id INTO chat_id_result
  FROM fogrup_chats c
  WHERE EXISTS (
    SELECT 1 FROM fogrup_chat_participants cp1
    WHERE cp1.chat_id = c.id AND cp1.user_id = user_id_1
  )
  AND EXISTS (
    SELECT 1 FROM fogrup_chat_participants cp2
    WHERE cp2.chat_id = c.id AND cp2.user_id = user_id_2
  )
  LIMIT 1;
  
  -- If chat exists, return its ID
  IF chat_id_result IS NOT NULL THEN
    RETURN chat_id_result;
  END IF;
  
  -- Create new chat
  INSERT INTO fogrup_chats (updated_at)
  VALUES (NOW())
  RETURNING id INTO chat_id_result;
  
  -- Add both users as participants
  INSERT INTO fogrup_chat_participants (chat_id, user_id)
  VALUES (chat_id_result, user_id_1), (chat_id_result, user_id_2);
  
  RETURN chat_id_result;
END;
$$ LANGUAGE plpgsql;
