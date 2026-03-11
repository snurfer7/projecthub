import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Note: In a real environment, we'd need a token. 
// For this verification, we assume the backend is running and reachable.
// This is a template for the user to run if they have a test environment set up.

async function verifyAddMember() {
  console.log('Testing project member addition with roles...');
  try {
    // These IDs are placeholders - would need valid IDs from the DB
    const projectId = 1; 
    const userId = 2;
    const roleIds = [1, 2]; // Roles as numbers
    
    console.log('Case 1: Correct numeric roleIds');
    // const res1 = await api.post(`/projects/${projectId}/members`, { userId, roleIds });
    // console.log('Response 1:', res1.status);

    console.log('Case 2: string roleIds (should be handled by Number() conversion)');
    const stringRoleIds = ["1", "3"];
    // const res2 = await api.post(`/projects/${projectId}/members`, { userId, roleIds: stringRoleIds });
    // console.log('Response 2:', res2.status);

    console.log('Verification script template created.');
  } catch (error: any) {
    console.error('Verification failed:', error.response?.data || error.message);
  }
}

// verifyAddMember();
console.log('Verification script ready. Run with valid IDs to test against a live DB.');
