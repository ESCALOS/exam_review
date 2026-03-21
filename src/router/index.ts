import { createRouter, createWebHashHistory } from 'vue-router'

import DashboardView from '../views/DashboardView.vue'
import ClassroomsView from '../views/ClassroomsView.vue'
import ExamsView from '../views/ExamsView.vue'
import GradingView from '../views/GradingView.vue'
import ReportsView from '../views/ReportsView.vue'
import BackupView from '../views/BackupView.vue'

const routes = [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/aulas', name: 'classrooms', component: ClassroomsView },
    { path: '/examenes', name: 'exams', component: ExamsView },
    { path: '/calificar', name: 'grading', component: GradingView },
    { path: '/reportes', name: 'reports', component: ReportsView },
    { path: '/respaldo', name: 'backup', component: BackupView },
]

export const router = createRouter({
    history: createWebHashHistory(),
    routes,
})
