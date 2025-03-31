// const baseUrl = 'http://localhost:5000'

const baseUrl = window.location.origin
const apiUrl = `${baseUrl}/api`

// console.log({ apiUrl })

const token = localStorage.getItem('authToken')

function handleUnauthorized(response) {
    if (response.status === 401) {
        console.log('Unauthorized')
        localStorage.removeItem('token')
        localStorage.removeItem('userData')
        window.location.href = baseUrl
    }
}