export default function Login() {
  return (
    <div className="max-w-7xl mx-auto px-4 pt-4">
      <details className="bg-white rounded-xl shadow border border-gray-200">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-gray-700">
          Manual Login
        </summary>
        <div className="p-4 pt-0 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
            Auto-auth active – manual login disabled
          </div>

          <form className="space-y-3" onSubmit={e => e.preventDefault()}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Login ID</label>
              <input
                type="text"
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100"
              />
            </div>

            <button
              type="submit"
              disabled
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold opacity-60 cursor-not-allowed"
            >
              Sign in
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
