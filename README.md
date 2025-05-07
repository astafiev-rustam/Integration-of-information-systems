|||
|---|---|
|ДИСЦИПЛИНА|Интеграция информационных систем с использованием API и микросервисов|
|Подразделение|ПИШ СВЧ-электроники|
|ВИД УЧЕБНОГО МАТЕРИАЛА|Методические указания к практическим занятиям|
|ПРЕПОДАВАТЕЛЬ|Астафьев Рустам Уралович|
|СЕМЕСТР|1 семестр, 2024/2025 уч. год|

Ссылка на GitHub репозиторий:
https://github.com/astafiev-rustam/Integration-of-information-systems/tree/Practice-1-8

## Практическое занятие №8 - GraphQL: особенности и применение. gRPC: высокопроизводительное взаимодействие. Продолжение

### gRPC: высокопроизводительное взаимодействие

gRPC — это современный фреймворк для удалённого вызова процедур (RPC), разработанный Google. Он использует **Protocol Buffers** (protobuf) для бинарной сериализации данных и **HTTP/2** для эффективной передачи. В отличие от REST, который работает с текстовыми форматами (JSON/XML), gRPC обеспечивает более высокую производительность и поддерживает **потоковую передачу данных**.  

Сейчас мы разберём, как работает gRPC. Все примеры будут на **Python**, но подходы легко перенести на другие языки (Go, Java, C++).  

---

## **Установка и настройка окружения**
Для работы с gRPC в Python понадобятся:
- `grpcio` (основная библиотека),
- `grpcio-tools` (генерация кода из `.proto`),
- `protobuf` (работа с Protocol Buffers).

Установим их:
```bash
pip install grpcio grpcio-tools protobuf
```

---

# **Практический пример gRPC: Система управления задачами (To-Do List)**

В этом примере мы создадим распределённую систему управления задачами с использованием gRPC. Сервер будет хранить список задач, а клиенты смогут добавлять, просматривать и отмечать задачи как выполненные. Мы реализуем:

1. **Unary RPC** для базовых операций
2. **Server Streaming** для отслеживания изменений в реальном времени
3. **Error Handling** для обработки ошибок

---

## **1. Определение API (todo.proto)**

Создаём файл `todo.proto` с описанием сервиса:

```protobuf
syntax = "proto3";

package todo;

service TodoService {
  // Добавление новой задачи (Unary)
  rpc AddTask (AddTaskRequest) returns (AddTaskResponse) {}
  
  // Получение списка задач (Unary)
  rpc GetTasks (GetTasksRequest) returns (GetTasksResponse) {}
  
  // Отметка задачи как выполненной (Unary)
  rpc CompleteTask (CompleteTaskRequest) returns (CompleteTaskResponse) {}
  
  // Потоковое обновление статусов задач (Server Streaming)
  rpc WatchTasks (WatchTasksRequest) returns (stream TaskUpdate) {}
}

// Структуры сообщений
message Task {
  int32 id = 1;
  string title = 2;
  bool completed = 3;
}

message AddTaskRequest {
  string title = 1;
}

message AddTaskResponse {
  Task task = 1;
}

message GetTasksRequest {}

message GetTasksResponse {
  repeated Task tasks = 1;
}

message CompleteTaskRequest {
  int32 task_id = 1;
}

message CompleteTaskResponse {
  bool success = 1;
}

message WatchTasksRequest {}

message TaskUpdate {
  Task task = 1;
  string action = 2;  // "ADDED", "COMPLETED"
}
```

**Компилируем в Python-код:**
```bash
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. todo.proto
```

---

## **2. Реализация сервера (server.py)**

```python
import grpc
from concurrent import futures
import time
from collections import defaultdict
from threading import Lock
import todo_pb2
import todo_pb2_grpc

class TodoService(todo_pb2_grpc.TodoServiceServicer):
    def __init__(self):
        self.tasks = []
        self.task_id_counter = 1
        self.subscribers = defaultdict(list)
        self.lock = Lock()

    def _notify_subscribers(self, task, action):
        """Отправляет обновление всем подписчикам"""
        update = todo_pb2.TaskUpdate(task=task, action=action)
        for queue in self.subscribers.values():
            queue.append(update)

    def AddTask(self, request, context):
        with self.lock:
            task = todo_pb2.Task(
                id=self.task_id_counter,
                title=request.title,
                completed=False
            )
            self.tasks.append(task)
            self.task_id_counter += 1
            
            # Уведомляем подписчиков
            self._notify_subscribers(task, "ADDED")
            
            return todo_pb2.AddTaskResponse(task=task)

    def GetTasks(self, request, context):
        return todo_pb2.GetTasksResponse(tasks=self.tasks)

    def CompleteTask(self, request, context):
        with self.lock:
            for task in self.tasks:
                if task.id == request.task_id:
                    task.completed = True
                    self._notify_subscribers(task, "COMPLETED")
                    return todo_pb2.CompleteTaskResponse(success=True)
            
            # Если задача не найдена
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("Task not found")
            return todo_pb2.CompleteTaskResponse(success=False)

    def WatchTasks(self, request, context):
        """Server Streaming: отправляет обновления в реальном времени"""
        queue = []
        subscriber_id = context.peer()
        self.subscribers[subscriber_id] = queue
        
        try:
            while True:
                if queue:
                    yield queue.pop(0)
                time.sleep(0.1)
        finally:
            # Удаляем подписчика при отключении
            self.subscribers.pop(subscriber_id, None)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    todo_pb2_grpc.add_TodoServiceServicer_to_server(TodoService(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    print("TodoService running on port 50051...")
    server.wait_for_termination()

if __name__ == "__main__":
    serve()
```

---

## **3. Реализация клиента (client.py)**

```python
import grpc
import threading
import todo_pb2
import todo_pb2_grpc

def watch_tasks(stub):
    """Поток для отслеживания обновлений"""
    try:
        for update in stub.WatchTasks(todo_pb2.WatchTasksRequest()):
            print(f"\n[Update] Task {update.task.id}: {update.action}")
            print(f"  Title: {update.task.title}")
            print(f"  Completed: {update.task.completed}")
    except grpc.RpcError as e:
        print(f"Watch error: {e.code()}")

def main():
    channel = grpc.insecure_channel("localhost:50051")
    stub = todo_pb2_grpc.TodoServiceStub(channel)

    # Запускаем поток для отслеживания обновлений
    watch_thread = threading.Thread(target=watch_tasks, args=(stub,))
    watch_thread.daemon = True
    watch_thread.start()

    # Основное меню
    while True:
        print("\n1. Add Task")
        print("2. List Tasks")
        print("3. Complete Task")
        print("4. Exit")
        choice = input("Select option: ")

        if choice == "1":
            title = input("Enter task title: ")
            response = stub.AddTask(todo_pb2.AddTaskRequest(title=title))
            print(f"Added task ID: {response.task.id}")

        elif choice == "2":
            response = stub.GetTasks(todo_pb2.GetTasksRequest())
            print("\nTasks:")
            for task in response.tasks:
                status = "✓" if task.completed else " "
                print(f"{status} {task.id}: {task.title}")

        elif choice == "3":
            task_id = int(input("Enter task ID to complete: "))
            response = stub.CompleteTask(todo_pb2.CompleteTaskRequest(task_id=task_id))
            print("Success!" if response.success else "Task not found")

        elif choice == "4":
            break

if __name__ == "__main__":
    main()
```

---

## **4. Запуск системы**

1. **Запустите сервер:**
   ```bash
   python server.py
   ```

2. **Запустите клиент (можно несколько экземпляров):**
   ```bash
   python client.py
   ```

3. **Пример работы:**
   - В первом клиенте добавьте задачу: "Купить молоко"
   - Во втором клиенте сразу увидите уведомление: "[Update] Task 1: ADDED"
   - Отметьте задачу выполненной в одном клиенте
   - В другом клиенте придёт уведомление: "[Update] Task 1: COMPLETED"

---

## **Когда использовать gRPC?**
### **Плюсы:**
- **Высокая скорость** (бинарный protobuf + HTTP/2).
- **Потоковая передача** (чат, реальные обновления).
- **Мультиязычность** (клиент и сервер на разных языках).

### **Минусы:**
- **Сложнее отлаживать** (нет человекочитаемого JSON).
- **Нужен HTTP/2** (не все старые системы поддерживают).

### **Где применять?**
- **Микросервисы** (Kubernetes, облачные API).
- **Стриминговые сервисы** (видео, чаты).
- **Внутренние API** (высокая нагрузка).

---

## **Заключение**
Мы разобрали основы gRPC, создали сервис с Unary и Streaming RPC и запустили его на Python. Теперь вы можете:
- Описывать API в `.proto`-файлах.
- Генерировать код для сервера и клиента.
- Реализовывать сложные сценарии с потоковой передачей.

---

## Задание

В качестве самостоятельной работы необходимо реализовать практический пример из данного занятия и попробовать дополнить его соответствующим графическим интерфейсом для взаимодействия с пользователем.
