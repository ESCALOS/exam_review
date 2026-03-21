<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/aulas', label: 'Aulas' },
  { to: '/examenes', label: 'Exámenes' },
  { to: '/calificar', label: 'Calificar' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/respaldo', label: 'Respaldo' },
]
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <div>
        <p class="kicker">Rexam</p>
        <h1>Revisión de exámenes</h1>
      </div>
      <p class="muted">Puntaje por examen · LocalStorage · Export/Import</p>
    </header>

    <nav class="main-nav">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="nav-link"
        active-class="active"
      >
        {{ link.label }}
      </RouterLink>
    </nav>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
