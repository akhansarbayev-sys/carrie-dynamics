# Carrie Dynamics — корпоративный сайт

Одностраничный сайт ТОО «CARRIE DYNAMICS», нефтесервисной компании полного цикла (Казахстан).

Фон: интерактивная 3D-модель геологического блока на three.js (литологический разрез, синтетическая сейсмика, структурная карта, буровые установки).

## Структура

```
index.html            главная страница
404.html              страница ошибки
assets/css/style.css  стили
assets/js/main.js     меню, навигация, анимации, копирование адреса
assets/js/scene.js    3D-сцена (three.js r128 с cdnjs)
favicon.svg, site.webmanifest, robots.txt
```

## Локальный запуск

Сборка не нужна, это статический сайт:

```bash
python3 -m http.server 8000
# открыть http://localhost:8000
```

## Публикация

GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`.
