# Интеграция информационных систем с использованием API и микросервисов
|||
|---|---|
|Направление подготовки|Дополнительная профессиональная программа профессиональной переподготовки|
|Подразделение|ПИШ СВЧ-электроники|
|Курс, семестр|1 семестр|

# **Практический пример: Асинхронная обработка заказов через RabbitMQ**  

В этом примере мы реализуем систему из двух микросервисов:  
1. **Order Service** – создает заказы и публикует события в RabbitMQ.  
2. **Notification Service** – подписывается на события и отправляет уведомления (в нашем случае просто логирует).  

Мы будем использовать:  
- **Python** (для простоты и читаемости).  
- **RabbitMQ** (как брокер сообщений).  
- **pika** (клиент RabbitMQ для Python).  

---

## **1. Настройка RabbitMQ**  
Перед началом работы убедитесь, что RabbitMQ запущен. Можно использовать Docker:  
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:management
```  
После запуска веб-интерфейс будет доступен на `http://localhost:15672` (логин: `guest`, пароль: `guest`).  

---

## **2. Order Service (Издатель событий)**  

### **Код (`order_service.py`)**  
```python
import pika
import json
import uuid

# Подключение к RabbitMQ
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# Создаем обменник (exchange) и очередь (queue)
channel.exchange_declare(exchange='orders', exchange_type='fanout')
channel.queue_declare(queue='notifications')  # Очередь для уведомлений
channel.queue_bind(exchange='orders', queue='notifications')

def create_order(user_id, product):
    """Создает заказ и публикует событие в RabbitMQ."""
    order_id = str(uuid.uuid4())
    order_data = {
        "event": "OrderCreated",
        "order_id": order_id,
        "user_id": user_id,
        "product": product
    }
    
    # Публикуем сообщение в обменник 'orders'
    channel.basic_publish(
        exchange='orders',
        routing_key='',  # Не используется в fanout
        body=json.dumps(order_data)
    )
    print(f"[Order Service] Заказ создан: {order_data}")
    return order_id

# Пример использования
if __name__ == "__main__":
    create_order("user123", "iPhone 15")
    create_order("user456", "MacBook Pro")
    connection.close()
```

### **Пояснение:**  
1. **`exchange_declare`** – создает обменник `orders` типа `fanout` (сообщения рассылаются всем подписанным очередям).  
2. **`queue_declare`** – создает очередь `notifications`.  
3. **`queue_bind`** – привязывает очередь к обменнику.  
4. **`basic_publish`** – отправляет сообщение в формате JSON.  

---

## **3. Notification Service (Подписчик на события)**  

### **Код (`notification_service.py`)**  
```python
import pika
import json

def send_notification(ch, method, properties, body):
    """Обрабатывает сообщения из очереди 'notifications'."""
    data = json.loads(body)
    print(f"[Notification Service] Получено событие: {data['event']}")
    print(f"Заказ #{data['order_id']} от пользователя {data['user_id']}")
    print(f"Товар: {data['product']}")
    print("Отправляем email-уведомление...\n")

# Подключение к RabbitMQ
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# Убедимся, что очередь существует
channel.queue_declare(queue='notifications')

# Подписываемся на очередь
channel.basic_consume(
    queue='notifications',
    on_message_callback=send_notification,
    auto_ack=True  # Автоматическое подтверждение обработки
)

print("[Notification Service] Ожидание сообщений. Для выхода нажмите CTRL+C")
channel.start_consuming()
```

### **Пояснение:**  
1. **`basic_consume`** – подписывается на очередь `notifications`.  
2. **`send_notification`** – вызывается при получении сообщения.  
3. **`auto_ack=True`** – автоматически подтверждает обработку (в продакшене лучше делать вручную).  

---

## **4. Запуск и тестирование**  

1. **Запустите Notification Service** (он будет ждать сообщений):  
   ```bash
   python notification_service.py
   ```  

2. **Запустите Order Service** (он отправит два заказа):  
   ```bash
   python order_service.py
   ```  

3. **Результат в Notification Service:**  
   ```
   [Notification Service] Получено событие: OrderCreated  
   Заказ #c7e5b3d4-... от пользователя user123  
   Товар: iPhone 15  
   Отправляем email-уведомление...  

   [Notification Service] Получено событие: OrderCreated  
   Заказ #f2a1c8e0-... от пользователя user456  
   Товар: MacBook Pro  
   Отправляем email-уведомление...  
   ```  

4. **Проверка в RabbitMQ:**  
   - Откройте `http://localhost:15672`.  
   - Во вкладке **Queues** увидите очередь `notifications`.  

---

## **5. Возможные улучшения**  

1. **Ретри и обработка ошибок:**  
   - Если Notification Service упал, RabbitMQ может повторно доставить сообщение.  

2. **Подтверждение (`ack`) вручную:**  
   ```python
   def send_notification(ch, method, properties, body):
       try:
           data = json.loads(body)
           print(f"Обработка: {data}")
           ch.basic_ack(delivery_tag=method.delivery_tag)  # Подтверждаем обработку
       except Exception as e:
           ch.basic_nack(delivery_tag=method.delivery_tag)  # Отклоняем сообщение
   ```  

3. **Разные типы событий:**  
   - Можно добавить обменник `direct` и маршрутизацию по ключам (`order.created`, `order.canceled`).  

---

## **Вывод**  
Этот пример показывает:  
Как микросервисы общаются асинхронно через RabbitMQ.  
Как избежать жесткой связности между сервисами.  
Как масштабировать обработку (можно запустить несколько экземпляров Notification Service).  

Такой подход используется в реальных проектах, например, для уведомлений, аналитики или обновления кэша.
