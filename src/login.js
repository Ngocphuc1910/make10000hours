import {useForm} from 'react-hook-form';
import {useState} from 'react';
import './styles.css';

function Login() {
    const {register, handleSubmit, formState: { errors }, reset} = useForm({
        defaultValues: {
            email: '',
            password: '',
            option: 'A',
            textarea: 'Default Value',
            'Terms & Conditions': false
        }
    });
    const [submittedData, setSubmittedData] = useState();

    const onSubmit = data => {
        setSubmittedData(data);
        alert("Login successful");
        reset();
    };

    console.log(errors); // Add this to see errors in console for debugging

    return (
        <div className="login-container">
            <h2 className="form-title">Login</h2>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="form-group">
                    <label className="form-label" htmlFor="email">Email address</label>
                    <input
                        className="form-input"
                        id="email"
                        {...register('email', {
                            required: "Email is required",
                            minLength: {
                                value: 5,
                                message: "Email must be at least 5 characters"
                            },
                            maxLength: {
                                value: 50,
                                message: "Email must not exceed 50 characters"
                            },
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: 'Invalid email address'
                            }
                        })}
                        placeholder="Enter your email"
                    />
                    {errors.email && <p className="error-text">{errors.email.message}</p>}
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="password">Password</label>
                    <input
                        className="form-input"
                        id="password"
                        type="password"
                        {...register('password', {
                            required: "Password is required",
                            minLength: {
                                value: 8,
                                message: "Password must be at least 8 characters"
                            },
                            maxLength: {
                                value: 20,
                                message: "Password must not exceed 20 characters"
                            },
                            pattern: {
                                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                                message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
                            }
                        })}
                        placeholder="Enter your password"
                    />
                    {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="option">Select Option</label>
                    <select 
                        className="form-select"
                        id="option"
                        {...register('option')}
                    >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="textarea">Additional Information</label>
                    <textarea 
                        className="form-textarea"
                        id="textarea"
                        {...register('textarea')} 
                        defaultValue='Default Value'
                    />
                </div>

                <div className="checkbox-container">
                    <input 
                        className="form-checkbox"
                        type="checkbox"
                        id="terms"
                        {...register('Terms & Conditions', { 
                            required: "You must accept the terms and conditions" 
                        })} 
                    />
                    <label htmlFor="terms">
                        Accept terms and conditions
                    </label>
                </div>
                {errors['Terms & Conditions'] && (
                    <p className="error-text">{errors['Terms & Conditions'].message}</p>
                )}

                <button type="submit" className="submit-button">
                    Login Here
                </button>
            </form>
        </div>
    );
}

export default Login;
