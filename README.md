# Car Park Multijugador

Multijugador para **Car Park Simulator** sin instalar nada y sin permisos de administrador.
Solo hace falta un navegador (Chrome, Edge o Firefox) e internet.

## Cómo funciona

El juego original es de un solo jugador, así que esto **no modifica el juego**: añade una sala
alrededor de él para jugar **carreras** con amigos.

- Uno crea la sala y pasa el **código de 5 letras** (o el enlace de invitación).
- El anfitrión elige un **nivel** y pulsa **¡Salida!** → cuenta atrás 3‑2‑1 en todas las pantallas.
- Cada uno juega ese nivel en su propio juego y pulsa **¡Terminé el nivel!** al aparcar.
- Puntos por puesto de llegada: 5, 3, 2, 1…
- **Compartir mi pantalla**: los demás ven tu partida en directo (así nadie hace trampa).
  Usa WebRTC, que ya viene en el navegador; no hace falta ffmpeg.
- Chat incluido.

La conexión entre jugadores es directa (WebRTC con [PeerJS](https://peerjs.com)); no hay servidor propio.

## Cómo abrirlo

**Opción A – GitHub Pages (recomendado):** en el repositorio, *Settings → Pages →
Deploy from a branch* y elige la rama. Después todos entran a la URL que te da GitHub.

**Opción B – sin publicar nada:** descarga `index.html` y ábrelo con doble clic.
Cada jugador necesita su copia (o pásale el archivo por chat).

## Si algo falla

- **El juego sale en blanco dentro de la página:** pulsa *Abrir juego en otra pestaña*
  y juega allí; la sala, el cronómetro y el chat siguen funcionando.
- **Juegas con tu copia local (`jugar_car_park.bat`):** en *Opciones avanzadas* pon
  `http://localhost:8000/index.html` como dirección del juego.
- **"Vuestras dos redes no consiguen conectarse entre sí"** (pasa en wifis de institutos,
  hoteles, etc., que aíslan a los dispositivos): crea una cuenta gratuita de servidor TURN
  (por ejemplo en metered.ca) y pega sus direcciones, usuario y contraseña en
  *Opciones avanzadas* antes de crear la sala. Viajan dentro del enlace de invitación.
- **"No se pudo conectar al servicio de salas":** algunas redes de colegio o trabajo
  bloquean WebRTC/PeerJS. Prueba con otra red o con datos móviles.
