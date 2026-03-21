import type { AppData } from '../types/models'

const STORAGE_KEY = 'exam-review-app-v1'

export function getDefaultData(): AppData {
    return {
        version: 1,
        classrooms: [],
        students: [],
        enrollments: [],
        exams: [],
        results: [],
        promotions: [],
    }
}

export function loadFromStorage(): AppData {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
        return getDefaultData()
    }

    try {
        const parsed = JSON.parse(raw) as Partial<AppData>

        return {
            version: parsed.version ?? 1,
            classrooms: parsed.classrooms ?? [],
            students: parsed.students ?? [],
            enrollments: parsed.enrollments ?? [],
            exams: parsed.exams ?? [],
            results: parsed.results ?? [],
            promotions: parsed.promotions ?? [],
        }
    } catch {
        return getDefaultData()
    }
}

export function saveToStorage(data: AppData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function replaceStorage(data: AppData): void {
    saveToStorage(data)
}
