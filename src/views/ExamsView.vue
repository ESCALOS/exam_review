<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ExamQuestion, QuestionType } from '../types/models'
import { createId } from '../utils/ids'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const examForm = ref({
  title: '',
  classroomId: '',
})
const editingExamId = ref('')

const questions = ref<ExamQuestion[]>([
  {
    id: createId('q'),
    prompt: '',
    type: 'mcq',
    points: 1,
    correctAnswer: '',
  },
])

const totalPoints = computed(() => questions.value.reduce((sum, q) => sum + Number(q.points || 0), 0))

function addQuestion(): void {
  questions.value.push({
    id: createId('q'),
    prompt: '',
    type: 'mcq',
    points: 1,
    correctAnswer: '',
  })
}

function removeQuestion(questionId: string): void {
  questions.value = questions.value.filter((item) => item.id !== questionId)
}

function updateType(question: ExamQuestion, type: QuestionType): void {
  question.type = type

  if (type === 'mcq') {
    question.correctAnswer = question.correctAnswer ?? ''
    return
  }

  delete question.correctAnswer
}

function submitExam(): void {
  const cleanedQuestions = questions.value
    .map((question) => ({
      ...question,
      prompt: question.prompt.trim(),
      points: Number(question.points),
      correctAnswer: question.type === 'mcq' ? (question.correctAnswer ?? '').trim() : undefined,
      options: undefined,
      correctOptionIndex: undefined,
    }))
    .filter((question) => {
      if (!question.prompt || question.points <= 0) {
        return false
      }

      if (question.type === 'mcq' && !question.correctAnswer) {
        return false
      }

      return true
    })

  if (!examForm.value.classroomId || !examForm.value.title.trim() || cleanedQuestions.length === 0) {
    return
  }

  if (editingExamId.value) {
    store.updateExam(editingExamId.value, {
      title: examForm.value.title,
      classroomId: examForm.value.classroomId,
      questions: cleanedQuestions,
    })
  } else {
    const exam = store.createExam({
      title: examForm.value.title,
      classroomId: examForm.value.classroomId,
      questions: cleanedQuestions,
    })

    if (!exam) {
      return
    }
  }

  resetForm()
}

function startEditExam(examId: string): void {
  const exam = store.getExamById(examId)

  if (!exam) {
    return
  }

  editingExamId.value = exam.id
  examForm.value.title = exam.title
  examForm.value.classroomId = exam.classroomId
  questions.value = exam.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    type: question.type,
    points: question.points,
    correctAnswer: question.correctAnswer ?? '',
  }))
}

function deleteExam(examId: string): void {
  if (!window.confirm('Se eliminará el examen y sus resultados. ¿Deseas continuar?')) {
    return
  }

  store.deleteExam(examId)

  if (editingExamId.value === examId) {
    resetForm()
  }
}

function resetForm(): void {
  editingExamId.value = ''
  examForm.value.title = ''
  examForm.value.classroomId = ''

  questions.value = [
    {
      id: createId('q'),
      prompt: '',
      type: 'mcq',
      points: 1,
      correctAnswer: '',
    },
  ]
}
</script>

<template>
  <section class="panel">
    <h1>Crear examen</h1>

    <article class="card">
      <h3>{{ editingExamId ? 'Editar examen' : 'Nuevo examen' }}</h3>
      <form class="grid-form" @submit.prevent="submitExam">
        <label>
          Título del examen
          <input v-model="examForm.title" type="text" required />
        </label>

        <label>
          Aula
          <select v-model="examForm.classroomId" required>
            <option value="">Seleccionar</option>
            <option v-for="classroom in store.classrooms" :key="classroom.id" :value="classroom.id">
              {{ classroom.name }}
            </option>
          </select>
        </label>

        <p class="muted">Puntaje total del examen: {{ totalPoints }}</p>

        <div class="stack full-width">
          <article v-for="(question, index) in questions" :key="question.id" class="sub-card">
            <header class="row-between">
              <strong>Pregunta {{ index + 1 }}</strong>
              <button type="button" class="small" @click="removeQuestion(question.id)">Eliminar</button>
            </header>

            <label>
              Enunciado
              <input v-model="question.prompt" type="text" required />
            </label>

            <div class="grid-form">
              <label>
                Tipo
                <select :value="question.type" @change="updateType(question, ($event.target as HTMLSelectElement).value as QuestionType)">
                  <option value="mcq">Opción múltiple</option>
                  <option value="free">Respuesta libre</option>
                </select>
              </label>
              <label>
                Puntaje
                <input v-model.number="question.points" type="number" min="1" step="0.25" required />
              </label>
            </div>

            <label v-if="question.type === 'mcq'">
              Alternativa correcta
              <input v-model="question.correctAnswer" type="text" placeholder="Ejemplo: B" required />
            </label>
          </article>
        </div>

        <div class="actions full-width">
          <button type="button" @click="addQuestion">Agregar pregunta</button>
          <button type="submit">{{ editingExamId ? 'Actualizar examen' : 'Guardar examen' }}</button>
          <button v-if="editingExamId" type="button" class="small" @click="resetForm">Cancelar edición</button>
        </div>
      </form>
    </article>

    <article class="card">
      <h3>Exámenes creados</h3>
      <ul v-if="store.exams.length" class="clean-list">
        <li v-for="exam in store.exams" :key="exam.id" class="list-row">
          <span class="list-main">
            <span class="list-title">{{ exam.title }}</span>
            <small class="muted list-meta">{{ exam.questions.length }} preguntas</small>
          </span>
          <div class="actions">
            <small>{{ exam.year }}</small>
            <button type="button" class="small icon-btn" @click="startEditExam(exam.id)">
              <span class="btn-icon" aria-hidden="true">✎</span>
              <span class="btn-text">Editar</span>
            </button>
            <button type="button" class="small danger icon-btn" @click="deleteExam(exam.id)">
              <span class="btn-icon" aria-hidden="true">🗑</span>
              <span class="btn-text">Eliminar</span>
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="muted">Aún no hay exámenes.</p>
    </article>
  </section>
</template>
