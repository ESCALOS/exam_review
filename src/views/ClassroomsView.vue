<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const form = ref({
  grade: 1,
  section: 'A',
  year: new Date().getFullYear(),
})

const studentNames = ref<Record<string, string>>({})
const editingClassroomId = ref('')
const editingStudentId = ref('')
const studentEditName = ref('')
const collapsedClassrooms = ref<Record<string, boolean>>({})
const promotion = ref({
  fromClassroomId: '',
  targetYear: new Date().getFullYear() + 1,
  selectedStudentIds: [] as string[],
})
const promotionMessage = ref('')

const classrooms = computed(() => [...store.classrooms].sort((a, b) => b.year - a.year || a.grade - b.grade))

const promotionStudents = computed(() => {
  if (!promotion.value.fromClassroomId) {
    return []
  }

  return store
    .getClassroomStudents(promotion.value.fromClassroomId)
    .filter((item) => item.enrollment.status === 'active')
})

const promotionSelectedCount = computed(() => promotion.value.selectedStudentIds.length)

watch(
  () => promotion.value.fromClassroomId,
  () => {
    promotion.value.selectedStudentIds = promotionStudents.value.map((item) => item.student.id)
  },
)

function submitClassroom(): void {
  if (editingClassroomId.value) {
    store.updateClassroom(editingClassroomId.value, {
      grade: Number(form.value.grade),
      section: form.value.section.trim().toUpperCase(),
      year: Number(form.value.year),
    })
    editingClassroomId.value = ''
    form.value = {
      grade: 1,
      section: 'A',
      year: new Date().getFullYear(),
    }
    return
  }

  store.createClassroom({
    grade: Number(form.value.grade),
    section: form.value.section.trim().toUpperCase(),
    year: Number(form.value.year),
  })
}

function cancelClassroomEdit(): void {
  editingClassroomId.value = ''
  form.value = {
    grade: 1,
    section: 'A',
    year: new Date().getFullYear(),
  }
}

function addStudent(classroomId: string): void {
  collapsedClassrooms.value[classroomId] = false
  const name = studentNames.value[classroomId] ?? ''
  const student = store.addStudentToClassroom(classroomId, name)

  if (student) {
    studentNames.value[classroomId] = ''
  }
}

function toggleEnrollment(enrollmentId: string, currentStatus: 'active' | 'withdrawn'): void {
  const nextStatus = currentStatus === 'active' ? 'withdrawn' : 'active'
  store.setEnrollmentStatus(enrollmentId, nextStatus)
}

function startEditClassroom(classroomId: string): void {
  const classroom = store.classrooms.find((item) => item.id === classroomId)

  if (!classroom) {
    return
  }

  editingClassroomId.value = classroomId
  collapsedClassrooms.value[classroomId] = false
  form.value = {
    grade: classroom.grade,
    section: classroom.section,
    year: classroom.year,
  }
}

function deleteClassroom(classroomId: string): void {
  if (!window.confirm('Se eliminará el aula junto con sus exámenes y resultados. ¿Continuar?')) {
    return
  }

  store.deleteClassroom(classroomId)

  if (editingClassroomId.value === classroomId) {
    editingClassroomId.value = ''
  }
}

function startEditStudent(studentId: string, fullName: string): void {
  editingStudentId.value = studentId
  studentEditName.value = fullName
}

function toggleClassroom(classroomId: string): void {
  collapsedClassrooms.value[classroomId] = !collapsedClassrooms.value[classroomId]
}

function isClassroomExpanded(classroomId: string): boolean {
  return !collapsedClassrooms.value[classroomId]
}

function saveStudentEdit(): void {
  if (!editingStudentId.value) {
    return
  }

  store.updateStudentName(editingStudentId.value, studentEditName.value)
  editingStudentId.value = ''
  studentEditName.value = ''
}

function removeStudent(enrollmentId: string): void {
  if (!window.confirm('Se eliminará el alumno de esta aula y sus resultados de esta aula. ¿Continuar?')) {
    return
  }

  store.removeEnrollment(enrollmentId)
}

function runPromotion(): void {
  const selected = promotion.value.selectedStudentIds

  if (!promotion.value.fromClassroomId || selected.length === 0) {
    promotionMessage.value = 'Selecciona aula y alumnos para promover.'
    return
  }

  const result = store.promoteStudents({
    fromClassroomId: promotion.value.fromClassroomId,
    targetYear: Number(promotion.value.targetYear),
    studentIds: selected,
  })

  if (!result) {
    promotionMessage.value = 'No se pudo ejecutar la promoción.'
    return
  }

  promotionMessage.value = `Promoción creada: ${result.classroom.name}. Alumnos movidos: ${result.moved}.`
  promotion.value.selectedStudentIds = []
}

function selectAllPromotionStudents(): void {
  promotion.value.selectedStudentIds = promotionStudents.value.map((item) => item.student.id)
}

function clearPromotionStudents(): void {
  promotion.value.selectedStudentIds = []
}
</script>

<template>
  <section class="panel">
    <h1>Aulas y alumnos</h1>

    <article class="card">
      <h3>{{ editingClassroomId ? 'Editar aula' : 'Crear aula' }}</h3>
      <form class="grid-form" @submit.prevent="submitClassroom">
        <label>
          Grado
          <input v-model.number="form.grade" type="number" min="1" max="12" required />
        </label>
        <label>
          Sección
          <input v-model="form.section" type="text" maxlength="2" required />
        </label>
        <label>
          Año
          <input v-model.number="form.year" type="number" min="2000" required />
        </label>
        <div class="actions full-width">
          <button type="submit">{{ editingClassroomId ? 'Guardar cambios' : 'Crear aula' }}</button>
          <button
            v-if="editingClassroomId"
            type="button"
            class="small"
            @click="cancelClassroomEdit"
          >
            Cancelar
          </button>
        </div>
      </form>
    </article>

    <article class="card">
      <h3>Promoción anual manual</h3>
      <div class="grid-form">
        <label>
          Aula origen
          <select v-model="promotion.fromClassroomId">
            <option value="">Seleccionar</option>
            <option v-for="classroom in classrooms" :key="classroom.id" :value="classroom.id">
              {{ classroom.name }}
            </option>
          </select>
        </label>
        <label>
          Año destino
          <input v-model.number="promotion.targetYear" type="number" min="2000" required />
        </label>
      </div>

      <div v-if="promotionStudents.length" class="promotion-toolbar">
        <p class="muted">
          Seleccionados: {{ promotionSelectedCount }} / {{ promotionStudents.length }}
        </p>
        <div class="actions">
          <button type="button" class="small" @click="selectAllPromotionStudents">Todos</button>
          <button type="button" class="small" @click="clearPromotionStudents">Limpiar</button>
        </div>
      </div>

      <div v-if="promotionStudents.length" class="promotion-grid">
        <label v-for="item in promotionStudents" :key="item.student.id" class="promotion-item">
          <input v-model="promotion.selectedStudentIds" type="checkbox" :value="item.student.id" />
          <span class="promotion-name">{{ item.student.fullName }}</span>
        </label>
      </div>

      <p v-else class="muted">
        No hay alumnos activos en el aula seleccionada.
      </p>

      <button type="button" @click="runPromotion">Pasar al siguiente año</button>
      <p class="muted">{{ promotionMessage }}</p>
    </article>

    <div class="classroom-grid">
      <article v-for="classroom in classrooms" :key="classroom.id" class="card">
        <div class="row-between">
          <h3 class="classroom-title">{{ classroom.name }}</h3>
          <div class="actions">
            <button
              type="button"
              class="small icon-btn icon-only"
              :title="isClassroomExpanded(classroom.id) ? 'Colapsar' : 'Expandir'"
              @click="toggleClassroom(classroom.id)"
            >
              <span class="btn-icon" aria-hidden="true">{{ isClassroomExpanded(classroom.id) ? '▾' : '▸' }}</span>
            </button>
            <button
              type="button"
              class="small icon-btn icon-only"
              title="Editar aula"
              aria-label="Editar aula"
              @click="startEditClassroom(classroom.id)"
            >
              <span class="btn-icon" aria-hidden="true">✎</span>
            </button>
            <button
              type="button"
              class="small danger icon-btn icon-only"
              title="Eliminar aula"
              aria-label="Eliminar aula"
              @click="deleteClassroom(classroom.id)"
            >
              <span class="btn-icon" aria-hidden="true">🗑</span>
            </button>
          </div>
        </div>

        <template v-if="isClassroomExpanded(classroom.id)">
        <form class="inline-form" @submit.prevent="addStudent(classroom.id)">
          <input
            v-model="studentNames[classroom.id]"
            type="text"
            placeholder="Nombre completo del alumno"
            required
          />
          <button type="submit" class="icon-btn icon-only" title="Agregar alumno" aria-label="Agregar alumno">
            <span class="btn-icon" aria-hidden="true">＋</span>
          </button>
        </form>

        <ul class="clean-list students-grid">
          <li
            v-for="item in store.getClassroomStudents(classroom.id)"
            :key="item.enrollment.id"
            class="list-row"
          >
            <span class="list-main">
              <template v-if="editingStudentId === item.student.id">
                <input v-model="studentEditName" type="text" />
              </template>
              <template v-else>
                <span class="list-title">{{ item.student.fullName }}</span>
              </template>
              <small class="muted list-meta">{{ item.resultCount }} exámenes corregidos</small>
            </span>
            <div class="actions">
              <button
                v-if="editingStudentId === item.student.id"
                type="button"
                class="small"
                @click="saveStudentEdit"
              >
                Guardar
              </button>
              <button
                v-else
                type="button"
                class="small icon-btn icon-only"
                title="Editar alumno"
                aria-label="Editar alumno"
                @click="startEditStudent(item.student.id, item.student.fullName)"
              >
                <span class="btn-icon" aria-hidden="true">✎</span>
              </button>
              <button
                type="button"
                class="small icon-btn icon-only"
                :title="item.enrollment.status === 'active' ? 'Retirar alumno' : 'Reactivar alumno'"
                :aria-label="item.enrollment.status === 'active' ? 'Retirar alumno' : 'Reactivar alumno'"
                @click="toggleEnrollment(item.enrollment.id, item.enrollment.status)"
              >
                <span class="btn-icon" aria-hidden="true">{{ item.enrollment.status === 'active' ? '⏸' : '↺' }}</span>
              </button>
              <button
                type="button"
                class="small danger icon-btn icon-only"
                title="Eliminar alumno"
                aria-label="Eliminar alumno"
                @click="removeStudent(item.enrollment.id)"
              >
                <span class="btn-icon" aria-hidden="true">🗑</span>
              </button>
            </div>
          </li>
        </ul>
        </template>
      </article>
    </div>
  </section>
</template>
